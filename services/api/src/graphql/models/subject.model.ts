import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Level } from '../../generated/prisma/client.js';

@ObjectType('Subject')
export class SubjectModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => Level) level!: Level;
}
