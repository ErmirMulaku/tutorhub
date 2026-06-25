import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('PaymentMethod')
export class PaymentMethodModel {
  @Field(() => ID) id!: string;
  @Field() brand!: string;
  @Field() last4!: string;
  @Field(() => Int) expMonth!: number;
  @Field(() => Int) expYear!: number;
}
