import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('TutorReview')
export class TutorReviewModel {
  @Field(() => ID) id!: string;
  @Field() studentName!: string;
  @Field(() => String, { nullable: true }) studentAvatarColor!: string | null;
  @Field() subjectName!: string;
  @Field(() => Int) rating!: number;
  @Field(() => String, { nullable: true }) comment!: string | null;
  @Field(() => String, { nullable: true }) reply!: string | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}

@ObjectType('ReviewSummary')
export class ReviewSummaryModel {
  @Field() average!: number;
  @Field(() => Int) count!: number;
  /** Counts for 5★, 4★, 3★, 2★, 1★ in that order. */
  @Field(() => [Int]) distribution!: number[];
}
