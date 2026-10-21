import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ReviewsApi } from '../../core/api/reviews-api';
import { cachedQuery, loadOnTags } from '../../core/api/cache-tags';
import { BookingsActions, bookingsFeature } from '../../core/bookings/bookings.store';
import { DashboardActions, dashboardFeature } from '../../core/dashboard/dashboard.store';
import { money, timeOf } from '../../core/format';
import { Avatar } from '../../shared/avatar';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import type { IconName } from '../../shared/icon';
import { type KpiDelta, KpiStat } from '../../shared/kpi-stat';
import { Skeleton } from '../../shared/skeleton';
import { StarRating } from '../../shared/star-rating';
import { StatusPill } from '../../shared/status-pill';

const BANNER_KEY = 'th_setup_dismissed';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** One KPI card's worth of display data (the template only loops over these). */
interface KpiCard {
  icon: IconName;
  label: string;
  value: string;
  delta?: KpiDelta;
}

function readBannerDismissed(): boolean {
  try {
    return sessionStorage.getItem(BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Port of features/dashboard/DashboardScreen.tsx.
 *
 * Data sources: the KPI summary, tutor name and published flag come from the
 * NgRx `dashboard` feature (the sidebar keeps them loaded); today's schedule
 * from the NgRx `bookings` feature; the latest review from a component-scoped
 * `cachedQuery` (nothing else needs it).
 */
@Component({
  selector: 'th-dashboard-page',
  imports: [
    RouterLink,
    Avatar,
    Button,
    Card,
    ErrorState,
    KpiStat,
    Skeleton,
    StarRating,
    StatusPill,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly store = inject(Store);
  private readonly reviewsApi = inject(ReviewsApi);

  private readonly summary = this.store.selectSignal(dashboardFeature.selectSummary);
  protected readonly summaryError = this.store.selectSignal(dashboardFeature.selectSummaryError);
  private readonly todayStatus = this.store.selectSignal(bookingsFeature.selectTodayStatus);
  protected readonly todayFailed = computed(() => this.todayStatus() === 'error');
  protected readonly me = this.store.selectSignal(dashboardFeature.selectMe);
  protected readonly published = this.store.selectSignal(dashboardFeature.selectPublished);
  protected readonly today = this.store.selectSignal(bookingsFeature.selectToday);

  private readonly reviews = cachedQuery({
    tags: ['Reviews'],
    load: () => this.reviewsApi.myReviews('all'),
  });

  protected readonly greeting = greeting();
  protected readonly firstName = computed(() => this.me()?.name.split(' ')[0] ?? 'there');
  protected readonly upNext = computed(() => this.today().find((b) => b.status === 'CONFIRMED'));
  protected readonly latestReview = computed(() => this.reviews.data()?.[0]);
  protected readonly bannerDismissed = signal(readBannerDismissed());
  protected readonly skeletons = [0, 1, 2, 3];

  /** The four KPI cards, or null while the summary hasn't arrived. */
  protected readonly kpis = computed<KpiCard[] | null>(() => {
    const s = this.summary();
    if (s === null) return null;
    return [
      { icon: 'calendar', label: 'Lessons today', value: String(s.lessonsToday) },
      { icon: 'dollar', label: 'Earnings this week', value: money(s.earningsWeekCents) },
      {
        icon: 'star',
        label: 'Average rating',
        value: s.avgRating ? s.avgRating.toFixed(1) : '—',
        ...(s.reviewCount > 0 && {
          delta: { text: `${String(s.reviewCount)} reviews`, tone: 'neutral' },
        }),
      },
      {
        icon: 'bell',
        label: 'Pending requests',
        value: String(s.pendingCount),
        ...(s.pendingCount > 0 && { delta: { text: 'Action needed', tone: 'danger' } }),
      },
    ];
  });

  protected readonly timeOf = timeOf;

  constructor() {
    // useGetTodayScheduleQuery() → load now, and again when 'Booking' is invalidated.
    loadOnTags(['Booking'], () => BookingsActions.loadToday());
  }

  protected retrySummary(): void {
    this.store.dispatch(DashboardActions.loadSummary());
  }

  protected retryToday(): void {
    this.store.dispatch(BookingsActions.loadToday());
  }

  protected dismissBanner(): void {
    this.bannerDismissed.set(true);
    try {
      sessionStorage.setItem(BANNER_KEY, '1');
    } catch {
      /* ignore */
    }
  }
}
