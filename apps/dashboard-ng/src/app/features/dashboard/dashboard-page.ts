import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ReviewsApi } from '../../core/api/reviews-api';
import { cachedQuery, loadOnTags } from '../../core/api/cache-tags';
import { BookingsActions, bookingsFeature } from '../../core/bookings/bookings.store';
import { dashboardFeature } from '../../core/dashboard/dashboard.store';
import { money, timeOf } from '../../core/format';
import { Avatar } from '../../shared/avatar';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { KpiStat } from '../../shared/kpi-stat';
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
  imports: [RouterLink, Avatar, Button, Card, KpiStat, Skeleton, StarRating, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly store = inject(Store);
  private readonly reviewsApi = inject(ReviewsApi);

  protected readonly summary = this.store.selectSignal(dashboardFeature.selectSummary);
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

  protected readonly money = money;
  protected readonly timeOf = timeOf;

  constructor() {
    // useGetTodayScheduleQuery() → load now, and again when 'Booking' is invalidated.
    loadOnTags(['Booking'], () => BookingsActions.loadToday());
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
