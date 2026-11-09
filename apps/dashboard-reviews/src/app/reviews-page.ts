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
import {
  Avatar,
  Button,
  cachedQuery,
  Card,
  dayOf,
  errorMessage,
  ErrorState,
  type Segment,
  SegmentedTabs,
  Skeleton,
  StarRating,
  ToastService,
} from '@ermulaku/dashboard-kit';
import { finalize } from 'rxjs';
import type { ReviewFilter, TutorReview } from './review.models';
import { ReviewsApi } from './reviews-api';

/**
 * One review with its reply, or a reply box (port of ReviewsScreen's
 * ReviewCard). The draft is a plain signal rather than a form: one field whose
 * only rule is "not blank".
 */
@Component({
  selector: 'th-review-card',
  imports: [Avatar, Button, StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'th-card review' },
  // Moved from the dashboard's global styles: the remote owns its look.
  styles: `
    .review__head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .review__who {
      flex: 1;
    }
    .review__name {
      font-size: 14px;
      font-weight: 700;
    }
    .review__body {
      margin: 12px 0 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .review__reply {
      margin-top: 12px;
      padding: 12px 14px;
      background: var(--primary-50);
      border-inline-start: 3px solid var(--primary);
      border-radius: 0 10px 10px 0;
      font-size: 13.5px;
    }
    .review__reply-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--primary-700);
      margin-bottom: 4px;
    }
    .review__reply-form {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .review__reply-form input {
      flex: 1;
      font: inherit;
      font-size: 13.5px;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--ink);
    }
  `,
  template: `
    @let r = review();
    <div class="review__head">
      <th-avatar [name]="r.studentName" size="md" />
      <div class="review__who">
        <div class="review__name">{{ r.studentName }}</div>
        <div class="muted">{{ r.subjectName }} · {{ dayOf(r.createdAt) }}</div>
      </div>
      <th-star-rating [value]="r.rating" />
    </div>
    @if (r.comment) {
      <p class="review__body">{{ r.comment }}</p>
    }
    @if (r.reply) {
      <div class="review__reply">
        <div class="review__reply-label">You replied</div>
        {{ r.reply }}
      </div>
    } @else {
      <div class="review__reply-form">
        <input
          #replyInput
          placeholder="Write a reply…"
          aria-label="Reply to {{ r.studentName }}"
          [value]="draft()"
          (input)="draft.set(replyInput.value)"
          (keydown.enter)="send()"
        />
        <button th-button size="sm" [disabled]="!canSend()" (click)="send()">Reply</button>
      </div>
    }
  `,
})
export class ReviewCard {
  private readonly api = inject(ReviewsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly review = input.required<TutorReview>();
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly canSend = computed(() => this.draft().trim() !== '' && !this.sending());
  protected readonly dayOf = dayOf;

  protected send(): void {
    if (!this.canSend()) return;
    this.sending.set(true);
    this.api
      .reply(this.review().id, this.draft().trim())
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        // The `Reviews` refetch swaps the box for the "You replied" block.
        next: () => this.toast.show('Reply posted'),
        error: (err: unknown) => this.toast.show(`Could not post the reply: ${errorMessage(err)}`),
      });
  }
}

const FILTERS: Segment<ReviewFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'unreplied', label: 'Needs reply' },
  { key: 'replied', label: 'Replied' },
];

/** Port of features/reviews/ReviewsScreen.tsx — rating summary, filter tabs, review list. */
@Component({
  selector: 'th-reviews-page',
  imports: [Card, ErrorState, ReviewCard, SegmentedTabs, Skeleton, StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Moved from the dashboard's global styles: the remote owns its look.
  styles: `
    .rev-summary {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 28px;
      margin-bottom: 16px;
    }
    .rev-summary__score {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
      border-inline-end: 1px solid var(--border-soft);
    }
    .rev-summary__avg {
      font-size: 48px;
      font-weight: 700;
      line-height: 1;
    }
    .rev-summary__dist {
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
    }
    .rev-summary__row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rev-summary__star {
      width: 28px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted);
    }
    .rev-summary__bar-track {
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .rev-summary__bar-fill {
      height: 100%;
      background: var(--star);
      border-radius: 999px;
    }
    .rev-summary__count {
      width: 24px;
      text-align: end;
      font-size: 12.5px;
    }
    .reviews__list {
      display: grid;
      gap: 14px;
    }
    /* Was in the dashboard's styles/_hosts.scss: the card host is a block. */
    th-review-card {
      display: block;
    }
    @media (max-width: 900px) {
      .rev-summary {
        grid-template-columns: 1fr;
      }
      .rev-summary__score {
        border-inline-end: none;
        border-bottom: 1px solid var(--border-soft);
        padding-bottom: 16px;
      }
    }
  `,
  template: `
    <div class="reviews">
      @if (summary.data(); as s) {
        <th-card class="rev-summary">
          <div class="rev-summary__score">
            <div class="rev-summary__avg">{{ s.average.toFixed(1) }}</div>
            <th-star-rating [value]="s.average" />
            <div class="muted">{{ s.count }} reviews</div>
          </div>
          <div class="rev-summary__dist">
            @for (row of distribution(); track row.stars) {
              <div class="rev-summary__row">
                <span class="rev-summary__star">{{ row.stars }}★</span>
                <div class="rev-summary__bar-track">
                  <div class="rev-summary__bar-fill" [style.width.%]="row.pct"></div>
                </div>
                <span class="muted rev-summary__count">{{ row.count }}</span>
              </div>
            }
          </div>
        </th-card>
      } @else if (summary.error()) {
        <th-error-state message="Could not load your rating summary." (retry)="summary.reload()" />
      }

      <th-segmented-tabs [segments]="filters" [value]="filter()" (changed)="filter.set($event)" />

      <div class="reviews__list">
        @if (reviews.isLoading()) {
          <th-skeleton [height]="140" />
        } @else if (reviews.error() && !reviews.data()) {
          <th-error-state message="Could not load your reviews." (retry)="reviews.reload()" />
        } @else {
          @for (r of reviews.data() ?? []; track r.id) {
            <th-review-card [review]="r" />
          } @empty {
            <p class="muted">No reviews in this view.</p>
          }
        }
      </div>
    </div>
  `,
})
export class ReviewsPage {
  private readonly api = inject(ReviewsApi);

  protected readonly filters = FILTERS;
  protected readonly filter = signal<ReviewFilter>('all');

  protected readonly summary = cachedQuery({ tags: ['Reviews'], load: () => this.api.summary() });
  /** Re-runs when the tab changes — React's `useGetMyReviewsQuery(filter)`. */
  protected readonly reviews = cachedQuery({
    tags: ['Reviews'],
    params: () => this.filter(),
    load: (filter) => this.api.myReviews(filter),
  });

  /** distribution[0] is 5★ … distribution[4] is 1★, each bar scaled to the largest. */
  protected readonly distribution = computed(() => {
    const counts = this.summary.data()?.distribution ?? [];
    const max = Math.max(1, ...counts);
    return counts.map((count, i) => ({
      stars: 5 - i,
      count,
      pct: Math.round((count / max) * 100),
    }));
  });
}
