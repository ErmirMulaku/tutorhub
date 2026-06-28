import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('WorkingHour')
export class WorkingHourModel {
  @Field(() => Int) day!: number; // 0 = Sunday … 6 = Saturday
  @Field() start!: string; // "HH:MM"
  @Field() end!: string;
}

@ObjectType('TimeOff')
export class TimeOffModel {
  @Field(() => ID) id!: string;
  @Field() label!: string;
  @Field(() => GraphQLISODateTime) startDate!: Date;
  @Field(() => GraphQLISODateTime) endDate!: Date;
}

@ObjectType('MyAvailability')
export class MyAvailabilityModel {
  @Field(() => [WorkingHourModel]) workingHours!: WorkingHourModel[];
  @Field(() => Int) bufferMinutes!: number;
  @Field(() => Int) minNoticeHours!: number;
  @Field(() => Int) maxLessonsPerDay!: number;
  @Field(() => [TimeOffModel]) timeOff!: TimeOffModel[];
}
