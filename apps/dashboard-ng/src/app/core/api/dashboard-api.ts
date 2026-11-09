import { Injectable, inject } from '@angular/core';
import { GraphqlClient } from '@ermulaku/dashboard-kit';
import { type Observable, map } from 'rxjs';
import type { DashboardSummary, LatestReview, TutorNotification } from './models';

/** KPI summary, the notifications feed and the latest review. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly gql = inject(GraphqlClient);

  summary(): Observable<DashboardSummary> {
    return this.gql
      .request<{
        dashboardSummary: DashboardSummary;
      }>(
        `{ dashboardSummary { lessonsToday earningsWeekCents avgRating reviewCount pendingCount unreadMessages } }`,
      )
      .pipe(map((r) => r.dashboardSummary));
  }

  notifications(): Observable<TutorNotification[]> {
    return this.gql
      .request<{
        tutorNotifications: TutorNotification[];
      }>(`{ tutorNotifications { id type title detail createdAt } }`)
      .pipe(map((r) => r.tutorNotifications));
  }

  /**
   * Newest review for the dashboard card — the same `myReviews` request the
   * Reviews page makes for its "All" tab (that page is now the Reviews remote).
   */
  latestReview(): Observable<LatestReview | null> {
    return this.gql
      .request<{
        myReviews: LatestReview[];
      }>(
        `query($filter: String){ myReviews(filter: $filter){ id studentName studentAvatarColor subjectName rating comment reply createdAt } }`,
        { filter: 'all' },
      )
      .pipe(map((r) => r.myReviews[0] ?? null));
  }
}
