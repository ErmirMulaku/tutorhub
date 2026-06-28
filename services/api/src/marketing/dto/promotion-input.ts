import { Field, GraphQLISODateTime, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { DiscountType } from '../../generated/prisma/client.js';

@InputType()
export class CreatePromotionInput {
  @Field()
  @IsString()
  @MinLength(2)
  name!: string;

  @Field()
  @IsString()
  @MinLength(3)
  code!: string;

  @Field(() => DiscountType)
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  discountValue!: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  expiresAt?: Date;
}
