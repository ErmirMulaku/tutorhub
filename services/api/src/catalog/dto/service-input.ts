import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Level, ServiceType } from '../../generated/prisma/client.js';

@InputType()
export class CreateServiceInput {
  @Field()
  @IsString()
  @MinLength(2)
  name!: string;

  @Field(() => ServiceType)
  @IsEnum(ServiceType)
  type!: ServiceType;

  @Field(() => Level)
  @IsEnum(Level)
  level!: Level;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @Field(() => Int, { defaultValue: 60 })
  @IsInt()
  @Min(15)
  durationMin!: number;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  lessonsCount!: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

@InputType()
export class UpdateServiceInput {
  @Field(() => ID)
  @IsString()
  id!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(15)
  durationMin?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
