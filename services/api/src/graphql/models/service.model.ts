import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Level, ServiceType } from '../../generated/prisma/client.js';

@ObjectType('Service')
export class ServiceModel {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field(() => ServiceType) type!: ServiceType;
  @Field(() => Level) level!: Level;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field(() => Int) priceCents!: number;
  @Field(() => Int) durationMin!: number;
  @Field(() => Int) lessonsCount!: number;
  @Field() isActive!: boolean;
  @Field(() => ID, { nullable: true }) subjectId!: string | null;
}
