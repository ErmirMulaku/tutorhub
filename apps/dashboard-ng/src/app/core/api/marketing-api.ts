import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type { CreatePromotionInput, MarketingSummary, Promotion, ReferralProgram } from './models';

/** Promotions, referrals and gift-card stats. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class MarketingApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  summary(): Observable<MarketingSummary> {
    return this.gql
      .request<{
        marketingSummary: MarketingSummary;
      }>(`{ marketingSummary { activePromotions redemptions giftCardsSoldCents } }`)
      .pipe(map((r) => r.marketingSummary));
  }

  promotions(): Observable<Promotion[]> {
    return this.gql
      .request<{
        promotions: Promotion[];
      }>(`{ promotions { id name code discountType discountValue state expiresAt redemptions } }`)
      .pipe(map((r) => r.promotions));
  }

  referralProgram(): Observable<ReferralProgram> {
    return this.gql
      .request<{
        referralProgram: ReferralProgram;
      }>(`{ referralProgram { creditCents referredCount issuedCents } }`)
      .pipe(map((r) => r.referralProgram));
  }

  createPromotion(input: CreatePromotionInput): Observable<{ id: string }> {
    return this.gql
      .request<{
        createPromotion: { id: string };
      }>(`mutation($input: CreatePromotionInput!){ createPromotion(input: $input){ id } }`, {
        input,
      })
      .pipe(
        map((r) => r.createPromotion),
        tap(() => this.tags.invalidate('Marketing')),
      );
  }

  endPromotion(id: string): Observable<void> {
    return this.gql.request(`mutation($id: ID!){ endPromotion(id: $id){ id state } }`, { id }).pipe(
      map(() => undefined),
      tap(() => this.tags.invalidate('Marketing')),
    );
  }
}
