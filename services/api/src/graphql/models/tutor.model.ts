import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { ReviewModel } from './review.model.js';
import { SubjectModel } from './subject.model.js';

@ObjectType('Tutor')
export class TutorModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) bio!: string | null;
  @Field(() => Int) hourlyCents!: number;
  @Field() timezone!: string;

  // Resolved fields (see TutorsResolver).
  @Field(() => Float, { nullable: true }) rating?: number | null;
  @Field(() => [SubjectModel]) subjects!: SubjectModel[];
  @Field(() => [ReviewModel]) reviews!: ReviewModel[];
}
