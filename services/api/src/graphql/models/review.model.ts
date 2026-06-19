import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Review')
export class ReviewModel {
  @Field(() => ID) id!: string;
  @Field(() => Int) rating!: number;
  @Field(() => String, { nullable: true }) comment!: string | null;
}
