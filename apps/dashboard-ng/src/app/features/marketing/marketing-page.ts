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
import { errorMessage } from '../../core/api/errors';
import { MarketingApi } from '../../core/api/marketing-api';
import type { Promotion, PromotionState } from '../../core/api/models';
import { money } from '../../core/format';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { CodeChip } from '../../shared/code-chip';
import { ErrorState } from '../../shared/error-state';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';
import { NewPromotionModal } from './new-promotion-modal';

const STATE_TONE: Record<PromotionState, string> = {
  ACTIVE: 'th-pill--success',
  SCHEDULED: 'th-pill--warn',
  ENDED: '',
};
const STATE_LABEL: Record<PromotionState, string> = {
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  ENDED: 'Ended',
};

/** One promotion in the grid (port of MarketingScreen's PromoCard). */
@Component({
  selector: 'th-promo-card',
  imports: [Button, CodeChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The host is the card (React: <Card className="promo">).
  host: { class: 'th-card promo' },
  template: `
    @let p = promo();
    <div class="promo__head">
      <h3 class="promo__name">{{ p.name }}</h3>
      <span class="th-pill {{ tone[p.state] }}">{{ label[p.state] }}</span>
    </div>
    <div class="promo__discount">{{ discount() }}</div>
    <th-code-chip [code]="p.code" />
    <div class="promo__foot muted">
      <span>{{ p.redemptions }} redeemed</span>
      @if (p.state !== 'ENDED') {
        <button th-button size="sm" variant="ghost" [disabled]="ending()" (click)="end()">
          End
        </button>
      }
    </div>
  `,
})
export class PromoCard {
  private readonly api = inject(MarketingApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly promo = input.required<Promotion>();
  protected readonly ending = signal(false);
  /** "15% off" or "$10.00 off" (a fixed discount is stored in cents). */
  protected readonly discount = computed(() => {
    const { discountType, discountValue } = this.promo();
    return discountType === 'PERCENT'
      ? `${String(discountValue)}% off`
      : `${money(discountValue)} off`;
  });
  protected readonly tone = STATE_TONE;
  protected readonly label = STATE_LABEL;

  protected end(): void {
    this.ending.set(true);
    this.api
      .endPromotion(this.promo().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // The `Marketing` refetch re-renders this card as "Ended" (no End button).
        next: () => this.toast.show('Promotion ended'),
        error: (err: unknown) => {
          this.ending.set(false);
          this.toast.show(`Could not end the promotion: ${errorMessage(err)}`);
        },
      });
  }
}

/** Port of features/marketing/MarketingScreen.tsx — stats, promotions, gift cards, referrals. */
@Component({
  selector: 'th-marketing-page',
  imports: [Button, Card, ErrorState, NewPromotionModal, PromoCard, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary.data(); as s) {
      <div class="mkt">
        <div class="mkt__stats">
          <th-card class="earn__stat">
            <div class="earn__stat-label">Active promotions</div>
            <div class="earn__stat-value">{{ s.activePromotions }}</div>
          </th-card>
          <th-card class="earn__stat">
            <div class="earn__stat-label">Redemptions</div>
            <div class="earn__stat-value">{{ s.redemptions }}</div>
          </th-card>
          <th-card class="earn__stat">
            <div class="earn__stat-label">Gift cards sold</div>
            <div class="earn__stat-value">{{ money(s.giftCardsSoldCents) }}</div>
          </th-card>
        </div>

        <div class="card-head">
          <h3>Promotions</h3>
          <button th-button size="sm" (click)="modalOpen.set(true)">New promotion</button>
        </div>
        @if (promotions.error() && !promotions.data()) {
          <th-error-state message="Could not load your promotions." (retry)="promotions.reload()" />
        } @else {
          <div class="mkt__promos">
            @for (p of promotions.data() ?? []; track p.id) {
              <th-promo-card [promo]="p" />
            }
          </div>
        }

        <div class="mkt__bottom">
          <th-card class="mkt__gift">
            <h3 class="card-head__title">Gift cards</h3>
            <p>Let students buy gift cards toward your lessons.</p>
            <div class="mkt__gift-value">{{ money(s.giftCardsSoldCents) }} sold</div>
          </th-card>
          @if (referral.data(); as r) {
            <th-card>
              <h3 class="card-head__title">Referral program</h3>
              <p class="muted">{{ money(r.creditCents) }} credit each, for you and a friend.</p>
              <div class="mkt__referral">
                <div>
                  <div class="mkt__referral-num">{{ r.referredCount }}</div>
                  <div class="muted">referred</div>
                </div>
                <div>
                  <div class="mkt__referral-num">{{ money(r.issuedCents) }}</div>
                  <div class="muted">issued</div>
                </div>
              </div>
            </th-card>
          }
        </div>

        <th-new-promotion-modal [open]="modalOpen()" (closed)="modalOpen.set(false)" />
      </div>
    } @else if (summary.error()) {
      <th-error-state message="Could not load your marketing stats." (retry)="summary.reload()" />
    } @else {
      <th-skeleton [height]="320" />
    }
  `,
})
export class MarketingPage {
  private readonly api = inject(MarketingApi);

  // Three requests under the 'Marketing' tag: creating or ending a promotion
  // refreshes the stats, the grid and the referral card together.
  protected readonly summary = cachedQuery({ tags: ['Marketing'], load: () => this.api.summary() });
  protected readonly promotions = cachedQuery({
    tags: ['Marketing'],
    load: () => this.api.promotions(),
  });
  protected readonly referral = cachedQuery({
    tags: ['Marketing'],
    load: () => this.api.referralProgram(),
  });
  protected readonly modalOpen = signal(false);

  protected readonly money = money;
}
