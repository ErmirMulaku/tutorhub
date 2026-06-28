import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { PayoutSchedule } from '../../generated/prisma/client.js';

@ObjectType('EarningsSummary')
export class EarningsSummaryModel {
  @Field(() => Int) availableCents!: number;
  @Field(() => Int) pendingCents!: number;
  @Field(() => Int) lifetimeCents!: number;
  @Field(() => String, { nullable: true }) payoutMethod!: string | null;
  @Field(() => PayoutSchedule) payoutSchedule!: PayoutSchedule;
}

@ObjectType('MonthlyEarning')
export class MonthlyEarningModel {
  @Field() month!: string; // "Jan", "Feb", …
  @Field(() => Int) netCents!: number;
}

@ObjectType('Transaction')
export class TransactionModel {
  @Field(() => ID) id!: string;
  @Field(() => GraphQLISODateTime) date!: Date;
  @Field() studentName!: string;
  @Field() subjectName!: string;
  @Field(() => Int) netCents!: number;
  @Field(() => Int) feeCents!: number;
  @Field() status!: string;
}
