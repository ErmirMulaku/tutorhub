import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

/** Top-of-dashboard KPIs for the signed-in tutor. */
@ObjectType('DashboardSummary')
export class DashboardSummaryModel {
  @Field(() => Int) lessonsToday!: number;
  @Field(() => Int) earningsWeekCents!: number;
  @Field(() => Float, { nullable: true }) avgRating!: number | null;
  @Field(() => Int) reviewCount!: number;
  @Field(() => Int) pendingCount!: number;
  @Field(() => Int) unreadMessages!: number;
}
