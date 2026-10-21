import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { cachedQuery } from '../../core/api/cache-tags';
import { CatalogApi } from '../../core/api/catalog-api';
import { errorMessage } from '../../core/api/errors';
import type { Service, ServiceType } from '../../core/api/models';
import { money } from '../../core/format';
import { Button } from '../../shared/button';
import { ErrorState } from '../../shared/error-state';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';
import { NewServiceModal } from './new-service-modal';

const TYPE_LABEL: Record<ServiceType, string> = {
  ONE_ON_ONE: '1:1',
  GROUP: 'Group',
  PACKAGE: 'Package',
};
const TYPE_TONE: Record<ServiceType, string> = {
  ONE_ON_ONE: 'svc-pill--primary',
  GROUP: 'svc-pill--info',
  PACKAGE: 'svc-pill--accent',
};

/** One service in the catalog grid (port of CatalogScreen's ServiceCard). */
@Component({
  selector: 'th-service-card',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The host is the card (React: <Card className="svc …">).
  host: { class: 'th-card svc', '[class.svc--hidden]': '!service().isActive' },
  template: `
    @let s = service();
    <div class="svc__head">
      <span class="svc-pill {{ tone[s.type] }}">{{ label[s.type] }}</span>
      <span class="svc__dot" [class.svc__dot--live]="s.isActive">
        {{ s.isActive ? 'Live' : 'Hidden' }}
      </span>
    </div>
    <h3 class="svc__name">{{ s.name }}</h3>
    <div class="muted svc__level">{{ s.level.toLowerCase() }}</div>
    @if (s.description) {
      <p class="svc__desc">{{ s.description }}</p>
    }
    <div class="svc__foot">
      <div>
        <span class="svc__price">{{ money(s.priceCents) }}</span>
        <span class="muted"> · {{ meta() }}</span>
      </div>
      <div class="svc__actions">
        <button th-button size="sm" variant="ghost" [disabled]="busy()" (click)="toggleActive()">
          {{ s.isActive ? 'Hide' : 'Show' }}
        </button>
        <button th-button size="sm" variant="ghost" [disabled]="busy()" (click)="remove()">
          Delete
        </button>
      </div>
    </div>
  `,
})
export class ServiceCard {
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly service = input.required<Service>();
  protected readonly busy = signal(false);
  /** "60 min" or "60 min · 5 lessons". */
  protected readonly meta = computed(() => {
    const { durationMin, lessonsCount } = this.service();
    const lessons = lessonsCount > 1 ? ` · ${String(lessonsCount)} lessons` : '';
    return `${String(durationMin)} min${lessons}`;
  });
  protected readonly label = TYPE_LABEL;
  protected readonly tone = TYPE_TONE;
  protected readonly money = money;

  protected toggleActive(): void {
    const s = this.service();
    this.busy.set(true);
    this.api
      .setServiceActive(s.id, !s.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busy.set(false),
        error: (err: unknown) => {
          this.busy.set(false);
          this.toast.show(`Could not update the service: ${errorMessage(err)}`);
        },
      });
  }

  protected remove(): void {
    this.busy.set(true);
    this.api
      .deleteService(this.service().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.toast.show('Service removed'),
        error: (err: unknown) => {
          this.busy.set(false);
          this.toast.show(`Could not remove the service: ${errorMessage(err)}`);
        },
      });
  }
}

/** Port of features/catalog/CatalogScreen.tsx. */
@Component({
  selector: 'th-catalog-page',
  imports: [Button, ErrorState, NewServiceModal, ServiceCard, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="catalog">
      <div class="catalog__head">
        <p class="muted">{{ services.data()?.length ?? 0 }} services on your catalog.</p>
        <button th-button size="sm" (click)="modalOpen.set(true)">New service</button>
      </div>

      @if (services.isLoading()) {
        <th-skeleton [height]="180" />
      } @else if (services.error() && !services.data()) {
        <th-error-state message="Could not load your catalog." (retry)="services.reload()" />
      } @else {
        <div class="catalog__grid">
          @for (s of services.data() ?? []; track s.id) {
            <th-service-card [service]="s" />
          }
          <button type="button" class="catalog__add" (click)="modalOpen.set(true)">
            + Add a new subject or package
          </button>
        </div>
      }

      <th-new-service-modal [open]="modalOpen()" (closed)="modalOpen.set(false)" />
    </div>
  `,
})
export class CatalogPage {
  private readonly api = inject(CatalogApi);
  protected readonly services = cachedQuery({
    tags: ['Service'],
    load: () => this.api.myServices(),
  });
  protected readonly modalOpen = signal(false);
}
