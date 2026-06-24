import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { ReviewModel } from './review.model.js';
import { SubjectModel } from './subject.model.js';

@ObjectType('Tutor')
export class TutorModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) bio!: string | null;
  @Field(() => String, { nullable: true }) headline!: string | null;
  @Field(() => Int) hourlyCents!: number;
  @Field() timezone!: string;
  @Field(() => String, { nullable: true }) avatarColor!: string | null;
  @Field(() => [String]) languages!: string[];
  @Field(() => [String]) badges!: string[];
  @Field(() => String, { nullable: true }) responseTime!: string | null;
  @Field(() => Int) totalLessons!: number;

  // Resolved fields (see TutorsResolver).
  @Field(() => Float, { nullable: true }) rating?: number | null;
  @Field(() => Int) reviewCount?: number;
  @Field(() => [SubjectModel]) subjects!: SubjectModel[];
  @Field(() => [ReviewModel]) reviews!: ReviewModel[];
}
