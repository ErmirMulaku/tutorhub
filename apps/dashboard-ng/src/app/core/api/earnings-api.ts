import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type {
  ConnectStatus,
  EarningsSummary,
  MonthlyEarning,
  PayoutSchedule,
  Transaction,
} from './models';

/** Balance, history, payouts and Stripe Connect. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class EarningsApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  summary(): Observable<EarningsSummary> {
    return this.gql
      .request<{
        earningsSummary: EarningsSummary;
      }>(
        `{ earningsSummary { availableCents pendingCents lifetimeCents payoutMethod payoutSchedule } }`,
      )
      .pipe(map((r) => r.earningsSummary));
  }

  byMonth(): Observable<MonthlyEarning[]> {
    return this.gql
      .request<{ earningsByMonth: MonthlyEarning[] }>(`{ earningsByMonth { month netCents } }`)
      .pipe(map((r) => r.earningsByMonth));
  }

  transactions(): Observable<Transaction[]> {
    return this.gql
      .request<{
        transactions: Transaction[];
      }>(`{ transactions { id date studentName subjectName netCents feeCents status } }`)
      .pipe(map((r) => r.transactions));
  }

  withdraw(): Observable<void> {
    return this.gql.request(`mutation { withdraw { availableCents } }`).pipe(
      map(() => undefined),
      tap(() => this.tags.invalidate('Earnings')),
    );
  }

  setPayoutSchedule(schedule: PayoutSchedule): Observable<void> {
    return this.gql
      .request(
        `mutation($s: PayoutSchedule!){ setPayoutSchedule(schedule: $s){ payoutSchedule } }`,
        { s: schedule },
      )
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Earnings', 'Settings')),
      );
  }

  setPayoutMethod(method: string): Observable<void> {
    return this.gql
      .request(`mutation($m: String!){ setPayoutMethod(method: $m){ payoutMethod } }`, {
        m: method,
      })
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Earnings', 'Settings')),
      );
  }

  connectStatus(): Observable<ConnectStatus> {
    return this.gql
      .request<{ connectStatus: ConnectStatus }>(`{ connectStatus { onboarded payoutsEnabled } }`)
      .pipe(map((r) => r.connectStatus));
  }

  /** Returns the hosted Stripe onboarding URL. Invalidates nothing (as in api.ts). */
  startConnectOnboarding(): Observable<{ url: string }> {
    return this.gql
      .request<{
        startConnectOnboarding: { url: string };
      }>(`mutation { startConnectOnboarding { url } }`)
      .pipe(map((r) => r.startConnectOnboarding));
  }
}
