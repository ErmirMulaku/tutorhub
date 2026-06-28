import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('AnalyticsSummary')
export class AnalyticsSummaryModel {
  @Field(() => Int) lessonsThisMonth!: number;
  @Field(() => Int) newStudents!: number;
  @Field(() => Int) repeatRatePct!: number;
  @Field(() => Int) utilizationPct!: number;
}

@ObjectType('MonthCount')
export class MonthCountModel {
  @Field() month!: string;
  @Field(() => Int) count!: number;
}

@ObjectType('SubjectShare')
export class SubjectShareModel {
  @Field() name!: string;
  @Field(() => Int) pct!: number;
}

@ObjectType('DayCount')
export class DayCountModel {
  @Field() day!: string;
  @Field(() => Int) count!: number;
}

@ObjectType('StudentMix')
export class StudentMixModel {
  @Field(() => Int) returningPct!: number;
  @Field(() => Int) newPct!: number;
}
