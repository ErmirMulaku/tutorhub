import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type { ReviewFilter, ReviewSummary, TutorReview } from './models';

/** Reviews and replies. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class ReviewsApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  summary(): Observable<ReviewSummary> {
    return this.gql
      .request<{ reviewSummary: ReviewSummary }>(`{ reviewSummary { average count distribution } }`)
      .pipe(map((r) => r.reviewSummary));
  }

  myReviews(filter: ReviewFilter = 'all'): Observable<TutorReview[]> {
    return this.gql
      .request<{
        myReviews: TutorReview[];
      }>(
        `query($filter: String){ myReviews(filter: $filter){ id studentName studentAvatarColor subjectName rating comment reply createdAt } }`,
        { filter },
      )
      .pipe(map((r) => r.myReviews));
  }

  reply(id: string, reply: string): Observable<void> {
    return this.gql
      .request(
        `mutation($id: ID!, $reply: String!){ replyToReview(id: $id, reply: $reply){ id } }`,
        {
          id,
          reply,
        },
      )
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Reviews', 'Notifications')),
      );
  }
}
