import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString, IsUUID, Length } from 'class-validator';

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

  /**
   * Optional. Send a unique value (e.g. a UUID) and reuse it when retrying the
   * same booking: the retry returns the first booking instead of a second one.
   */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  idempotencyKey?: string;
}
