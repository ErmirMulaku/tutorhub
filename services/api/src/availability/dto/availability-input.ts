import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString, Max, Min } from 'class-validator';

@InputType()
export class WorkingHourInput {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @Field()
  @IsString()
  start!: string;

  @Field()
  @IsString()
  end!: string;
}

@InputType()
export class BookingRulesInput {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  bufferMinutes!: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  minNoticeHours!: number;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  maxLessonsPerDay!: number;
}

@InputType()
export class TimeOffInput {
  @Field()
  @IsString()
  label!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;
}
