import { Field, Int, ObjectType } from '@nestjs/graphql';
import { TutorModel } from './tutor.model.js';

@ObjectType('TutorPage')
export class TutorPageModel {
  @Field(() => [TutorModel]) items!: TutorModel[];
  @Field(() => Int) total!: number;
  @Field() hasMore!: boolean;
}
