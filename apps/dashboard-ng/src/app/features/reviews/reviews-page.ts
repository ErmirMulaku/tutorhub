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
import { finalize } from 'rxjs';
import { cachedQuery } from '../../core/api/cache-tags';
import { errorMessage } from '../../core/api/errors';
import type { ReviewFilter, TutorReview } from '../../core/api/models';
import { ReviewsApi } from '../../core/api/reviews-api';
import { dayOf } from '../../core/format';
import { Avatar } from '../../shared/avatar';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { type Segment, SegmentedTabs } from '../../shared/segmented-tabs';
import { Skeleton } from '../../shared/skeleton';
import { StarRating } from '../../shared/star-rating';
import { ToastService } from '../../shared/toast';

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
