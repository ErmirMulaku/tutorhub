import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BadRequestDomainError, ConflictDomainError } from '../common/errors.js';
import type { GiftCard, PaymentMethod } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface WalletSummary {
  balanceCents: number;
  giftCards: GiftCard[];
  paymentMethods: PaymentMethod[];
}

export interface BuyGiftCardInput {
  amountCents: number;
  design: number;
  toName?: string | null;
  fromName?: string | null;
  message?: string | null;
}

/** Wallet balance, gift cards and (mocked) payment methods. */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(studentId: string): Promise<WalletSummary> {
    const [student, giftCards, paymentMethods] = await Promise.all([
      this.prisma.student.findUniqueOrThrow({ where: { id: studentId } }),
      this.prisma.giftCard.findMany({
        where: { ownerId: studentId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.paymentMethod.findMany({
        where: { studentId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { balanceCents: student.walletCents, giftCards, paymentMethods };
  }

  /**
   * Redeem a gift card code: move its remaining balance into the wallet.
   *
   * The card is emptied with a compare-and-set: "set balance to 0 only if it
   * is still exactly the amount I read (and still mine or unowned)". If two
   * redeems race, both read 50, but only the first UPDATE matches; the second
   * waits for it, re-checks the WHERE against the committed row (balance 0)
   * and matches nothing. The wallet is credited in the same transaction, with
   * the amount the winning UPDATE proved was there.
   */
  async redeem(studentId: string, code: string): Promise<WalletSummary> {
    const card = await this.prisma.giftCard.findUnique({ where: { code: code.trim() } });
    if (card === null) {
      throw new BadRequestDomainError('That gift card code is not valid.');
    }
    if (card.balanceCents <= 0) {
      throw new BadRequestDomainError('This gift card has already been redeemed.');
    }
    if (card.ownerId !== null && card.ownerId !== studentId) {
      throw new BadRequestDomainError('This gift card belongs to another account.');
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.giftCard.updateMany({
        where: {
          id: card.id,
          balanceCents: card.balanceCents,
          OR: [{ ownerId: null }, { ownerId: studentId }],
        },
        data: { balanceCents: 0, ownerId: studentId },
      });
      if (count === 0) {
        throw new ConflictDomainError('This gift card has already been redeemed.');
      }
      await tx.student.update({
        where: { id: studentId },
        data: { walletCents: { increment: card.balanceCents } },
      });
    });
    return this.summary(studentId);
  }

  /** Buy a gift card (mocked payment). The buyer owns it until they share the code. */
  async buyGiftCard(studentId: string, input: BuyGiftCardInput): Promise<GiftCard> {
    if (input.amountCents < 500) {
      throw new BadRequestDomainError('Minimum gift card amount is 5.');
    }
    const code = `TH-${segment()}-${segment()}`;
    return this.prisma.giftCard.create({
      data: {
        code,
        amountCents: input.amountCents,
        balanceCents: input.amountCents,
        design: input.design,
        toName: input.toName ?? null,
        fromName: input.fromName ?? null,
        message: input.message ?? null,
        ownerId: studentId,
      },
    });
  }

  addPaymentMethod(
    studentId: string,
    brand: string,
    last4: string,
    expMonth: number,
    expYear: number,
  ): Promise<PaymentMethod> {
    return this.prisma.paymentMethod.create({
      data: { studentId, brand, last4, expMonth, expYear },
    });
  }

  async removePaymentMethod(studentId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.paymentMethod.deleteMany({ where: { id, studentId } });
    return count > 0;
  }
}

/** A short uppercase alphanumeric segment for gift card codes (e.g. 4F9K). */
function segment(): string {
  return randomBytes(2).toString('hex').toUpperCase();
}
