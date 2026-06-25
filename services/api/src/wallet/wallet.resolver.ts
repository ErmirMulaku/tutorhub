import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { GiftCard, PaymentMethod } from '../generated/prisma/client.js';
import { GiftCardModel } from '../graphql/models/gift-card.model.js';
import { PaymentMethodModel } from '../graphql/models/payment-method.model.js';
import { WalletModel } from '../graphql/models/wallet.model.js';
import type { WalletSummary } from './wallet.service.js';
import { WalletService } from './wallet.service.js';

@Resolver(() => WalletModel)
@UseGuards(JwtAuthGuard)
export class WalletResolver {
  constructor(private readonly wallet: WalletService) {}

  @Query(() => WalletModel, { name: 'wallet' })
  walletSummary(@CurrentUser() user: AuthUser): Promise<WalletSummary> {
    return this.wallet.summary(user.studentId);
  }

  @Mutation(() => WalletModel, { name: 'redeemGiftCard' })
  redeemGiftCard(
    @CurrentUser() user: AuthUser,
    @Args('code') code: string,
  ): Promise<WalletSummary> {
    return this.wallet.redeem(user.studentId, code);
  }

  @Mutation(() => GiftCardModel, { name: 'buyGiftCard' })
  buyGiftCard(
    @CurrentUser() user: AuthUser,
    @Args('amountCents', { type: () => Int }) amountCents: number,
    @Args('design', { type: () => Int, defaultValue: 0 }) design: number,
    @Args('toName', { type: () => String, nullable: true }) toName: string | undefined,
    @Args('fromName', { type: () => String, nullable: true }) fromName: string | undefined,
    @Args('message', { type: () => String, nullable: true }) message: string | undefined,
  ): Promise<GiftCard> {
    return this.wallet.buyGiftCard(user.studentId, {
      amountCents,
      design,
      toName,
      fromName,
      message,
    });
  }

  @Mutation(() => PaymentMethodModel, { name: 'addPaymentMethod' })
  addPaymentMethod(
    @CurrentUser() user: AuthUser,
    @Args('brand') brand: string,
    @Args('last4') last4: string,
    @Args('expMonth', { type: () => Int }) expMonth: number,
    @Args('expYear', { type: () => Int }) expYear: number,
  ): Promise<PaymentMethod> {
    return this.wallet.addPaymentMethod(user.studentId, brand, last4, expMonth, expYear);
  }

  @Mutation(() => Boolean, { name: 'removePaymentMethod' })
  removePaymentMethod(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.wallet.removePaymentMethod(user.studentId, id);
  }
}
