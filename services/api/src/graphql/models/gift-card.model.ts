import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('GiftCard')
export class GiftCardModel {
  @Field(() => ID) id!: string;
  @Field() code!: string;
  @Field(() => Int) amountCents!: number;
  @Field(() => Int) balanceCents!: number;
  @Field(() => Int) design!: number;
  @Field(() => String, { nullable: true }) fromName!: string | null;
  @Field(() => String, { nullable: true }) toName!: string | null;
  @Field(() => String, { nullable: true }) message!: string | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}
