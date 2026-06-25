import { Field, Int, ObjectType } from '@nestjs/graphql';
import { GiftCardModel } from './gift-card.model.js';
import { PaymentMethodModel } from './payment-method.model.js';

@ObjectType('Wallet')
export class WalletModel {
  @Field(() => Int) balanceCents!: number;
  @Field(() => [GiftCardModel]) giftCards!: GiftCardModel[];
  @Field(() => [PaymentMethodModel]) paymentMethods!: PaymentMethodModel[];
}
