import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { DiscountType, PromotionState } from '../../generated/prisma/client.js';

@ObjectType('Promotion')
export class PromotionModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() code!: string;
  @Field(() => DiscountType) discountType!: DiscountType;
  @Field(() => Int) discountValue!: number;
  @Field(() => PromotionState) state!: PromotionState;
  @Field(() => GraphQLISODateTime, { nullable: true }) expiresAt!: Date | null;
  @Field(() => Int) redemptions!: number;
}

@ObjectType('ReferralProgram')
export class ReferralModel {
  @Field(() => Int) creditCents!: number;
  @Field(() => Int) referredCount!: number;
  @Field(() => Int) issuedCents!: number;
}

@ObjectType('MarketingSummary')
export class MarketingSummaryModel {
  @Field(() => Int) activePromotions!: number;
  @Field(() => Int) redemptions!: number;
  @Field(() => Int) giftCardsSoldCents!: number;
}
