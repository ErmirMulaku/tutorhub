import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import { PromotionState, type Promotion, type Referral } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePromotionInput } from './dto/promotion-input.js';

export interface MarketingSummary {
  activePromotions: number;
  redemptions: number;
  giftCardsSoldCents: number;
}

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tutorId: string): Promise<MarketingSummary> {
    const [activePromotions, promos, giftCards] = await Promise.all([
      this.prisma.promotion.count({ where: { tutorId, state: PromotionState.ACTIVE } }),
      this.prisma.promotion.findMany({ where: { tutorId }, select: { redemptions: true } }),
      this.prisma.giftCard.findMany({ where: { tutorId }, select: { amountCents: true } }),
    ]);
    return {
      activePromotions,
      redemptions: promos.reduce((s, p) => s + p.redemptions, 0),
      giftCardsSoldCents: giftCards.reduce((s, g) => s + g.amountCents, 0),
    };
  }

  promotions(tutorId: string): Promise<Promotion[]> {
    return this.prisma.promotion.findMany({ where: { tutorId }, orderBy: { createdAt: 'desc' } });
  }

  /** The tutor's referral program, created on first read. */
  async referralProgram(tutorId: string): Promise<Referral> {
    const existing = await this.prisma.referral.findUnique({ where: { tutorId } });
    if (existing !== null) return existing;
    return this.prisma.referral.create({ data: { tutorId } });
  }

  createPromotion(tutorId: string, input: CreatePromotionInput): Promise<Promotion> {
    return this.prisma.promotion.create({
      data: { ...input, tutorId, state: PromotionState.ACTIVE, startsAt: new Date() },
    });
  }

  async endPromotion(tutorId: string, id: string): Promise<Promotion> {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (promo === null || promo.tutorId !== tutorId) {
      throw new EntityNotFoundError('Promotion', id);
    }
    return this.prisma.promotion.update({
      where: { id },
      data: { state: PromotionState.ENDED },
    });
  }
}
