import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import { ReviewSummaryModel, TutorReviewModel } from '../graphql/models/tutor-review.model.js';
import {
  type ReviewFilter,
  type ReviewSummary,
  ReviewsService,
  type TutorReviewRow,
} from './reviews.service.js';

@Resolver()
@UseGuards(TutorAuthGuard)
export class ReviewsResolver {
  constructor(private readonly reviews: ReviewsService) {}

  @Query(() => [TutorReviewModel], { name: 'myReviews' })
  myReviews(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('filter', { type: () => String, nullable: true }) filter: string | undefined,
  ): Promise<TutorReviewRow[]> {
    return this.reviews.list(tutor.tutorId, (filter as ReviewFilter | undefined) ?? 'all');
  }

  @Query(() => ReviewSummaryModel, { name: 'reviewSummary' })
  reviewSummary(@CurrentTutor() tutor: TutorPrincipal): Promise<ReviewSummary> {
    return this.reviews.summary(tutor.tutorId);
  }

  @Mutation(() => [TutorReviewModel], { name: 'replyToReview' })
  replyToReview(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
    @Args('reply') reply: string,
  ): Promise<TutorReviewRow[]> {
    return this.reviews.reply(tutor.tutorId, id, reply);
  }
}
