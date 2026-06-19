import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsUUID } from 'class-validator';

@InputType()
export class BookInput {
  @Field(() => ID)
  @IsUUID()
  tutorId!: string;

  @Field(() => ID)
  @IsUUID()
  subjectId!: string;

  /** Lesson start; the engine derives a fixed-length end. */
  @Field(() => GraphQLISODateTime)
  @IsDate()
  startTime!: Date;
}
