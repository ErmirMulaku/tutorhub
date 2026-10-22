import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { loadOnTags } from '../core/api/cache-tags';
import { DashboardActions, dashboardFeature } from '../core/dashboard/dashboard.store';
import { Icon } from '../shared/icon';

/** "5m" / "3h" / "2d" since an ISO timestamp. */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${String(Math.max(1, mins))}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${String(hrs)}h`;
  return `${String(Math.round(hrs / 24))}d`;
}

const DOT: Record<string, string> = {
  booking: 'notif__dot--warn',
  message: 'notif__dot--primary',
  review: 'notif__dot--star',
};

/**
 * Port of components/NotificationsBell.tsx. The feed lives in the NgRx
 * `dashboard` feature under the `Notifications` tag, which booking and message
 * mutations — and the live socket events — invalidate, so it stays current.
 */
@Component({
  selector: 'th-notifications-bell',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'notif',
    // React added/removed a document listener while open; a host listener is
    // always attached and simply ignores clicks while closed.
    '(document:mousedown)': 'onDocumentMouseDown($event)',
  },
  template: `
    <button
      type="button"
      class="topbar__icon-btn topbar__bell"
      aria-label="Notifications"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <svg th-icon="bell"></svg>
      @if (notifications().length > 0) {
        <span class="topbar__bell-dot"></span>
      }
    </button>
    @if (open()) {
      <div class="notif__panel th-fade-up">
        <div class="notif__head">Notifications</div>
        @for (n of notifications(); track n.id) {
          <div class="notif__item">
            <span class="notif__dot {{ dotFor(n.type) }}"></span>
            <div class="notif__body">
              <div class="notif__title">{{ n.title }}</div>
              @if (n.detail) {
                <div class="muted notif__detail">{{ n.detail }}</div>
              }
            </div>
            <span class="muted notif__time">{{ ago(n.createdAt) }}</span>
          </div>
        } @empty {
          <div class="notif__empty muted">You're all caught up.</div>
        }
      </div>
    }
  `,
})
export class NotificationsBell {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly notifications = inject(Store).selectSignal(
    dashboardFeature.selectNotifications,
  );
  protected readonly open = signal(false);
  protected readonly ago = ago;

  constructor() {
    loadOnTags(['Notifications'], () => DashboardActions.loadNotifications());
  }

  protected dotFor(type: string): string {
    return DOT[type] ?? 'notif__dot--primary';
  }

  /** Close on a click outside the bell and its panel. */
  protected onDocumentMouseDown(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
