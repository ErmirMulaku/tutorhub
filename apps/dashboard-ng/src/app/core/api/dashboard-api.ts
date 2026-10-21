import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { GraphqlClient } from './graphql-client';
import type { DashboardSummary, TutorNotification } from './models';

/** KPI summary + the notifications feed. Documents copied from api.ts. */
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
}
