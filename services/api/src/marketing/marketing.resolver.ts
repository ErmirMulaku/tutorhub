import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import type { Promotion, Referral } from '../generated/prisma/client.js';
import {
  MarketingSummaryModel,
  PromotionModel,
  ReferralModel,
} from '../graphql/models/marketing.model.js';
import { CreatePromotionInput } from './dto/promotion-input.js';
import { type MarketingSummary, MarketingService } from './marketing.service.js';

@Resolver()
@UseGuards(TutorAuthGuard)
export class MarketingResolver {
  constructor(private readonly marketing: MarketingService) {}

  @Query(() => MarketingSummaryModel, { name: 'marketingSummary' })
  marketingSummary(@CurrentTutor() tutor: TutorPrincipal): Promise<MarketingSummary> {
    return this.marketing.summary(tutor.tutorId);
  }

  @Query(() => [PromotionModel], { name: 'promotions' })
  promotions(@CurrentTutor() tutor: TutorPrincipal): Promise<Promotion[]> {
    return this.marketing.promotions(tutor.tutorId);
  }

  @Query(() => ReferralModel, { name: 'referralProgram' })
  referralProgram(@CurrentTutor() tutor: TutorPrincipal): Promise<Referral> {
    return this.marketing.referralProgram(tutor.tutorId);
  }

  @Mutation(() => PromotionModel, { name: 'createPromotion' })
  createPromotion(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('input') input: CreatePromotionInput,
  ): Promise<Promotion> {
    return this.marketing.createPromotion(tutor.tutorId, input);
  }

  @Mutation(() => PromotionModel, { name: 'endPromotion' })
  endPromotion(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Promotion> {
    return this.marketing.endPromotion(tutor.tutorId, id);
  }
}
