import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BadRequestDomainError } from '../common/errors.js';
import { PaymentStatus, type PayoutSchedule } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StripeService } from '../stripe/stripe.service.js';

export interface EarningsSummary {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  payoutMethod: string | null;
  payoutSchedule: PayoutSchedule;
}
export interface MonthlyEarning {
  month: string;
  netCents: number;
}
export interface TransactionRow {
  id: string;
  date: Date;
  studentName: string;
  subjectName: string;
  netCents: number;
  feeCents: number;
  status: string;
}
export interface ConnectStatus {
  onboarded: boolean;
  payoutsEnabled: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class EarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  async summary(tutorId: string): Promise<EarningsSummary> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    const net = (rows: { amountCents: number; feeCents: number }[]): number =>
      rows.reduce((sum, p) => sum + (p.amountCents - p.feeCents), 0);

    const [available, pending, lifetime] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tutorId, status: PaymentStatus.PAID, payoutId: null },
        select: { amountCents: true, feeCents: true },
      }),
      this.prisma.payment.findMany({
        where: { tutorId, status: PaymentStatus.PENDING },
        select: { amountCents: true, feeCents: true },
      }),
      this.prisma.payment.findMany({
        where: { tutorId, status: PaymentStatus.PAID },
        select: { amountCents: true, feeCents: true },
      }),
    ]);

    return {
      availableCents: net(available),
      pendingCents: net(pending),
      lifetimeCents: net(lifetime),
      payoutMethod: tutor.payoutMethod,
      payoutSchedule: tutor.payoutSchedule,
    };
  }

  /** Net earnings per calendar month for the last 8 months (oldest → newest). */
  async byMonth(tutorId: string, now: Date = new Date()): Promise<MonthlyEarning[]> {
    const payments = await this.prisma.payment.findMany({
      where: { tutorId, status: PaymentStatus.PAID },
      select: { amountCents: true, feeCents: true, booking: { select: { startTime: true } } },
    });
    const buckets: MonthlyEarning[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ month: MONTHS[d.getMonth()] ?? '', netCents: 0 });
    }
    const firstMonthIndex = new Date(now.getFullYear(), now.getMonth() - 7, 1).getTime();
    for (const p of payments) {
      const t = p.booking.startTime;
      const key = new Date(t.getFullYear(), t.getMonth(), 1).getTime();
      if (key < firstMonthIndex) continue;
      const monthsAgo =
        (now.getFullYear() - t.getFullYear()) * 12 + (now.getMonth() - t.getMonth());
      const idx = 7 - monthsAgo;
      const bucket = buckets[idx];
      if (bucket) bucket.netCents += p.amountCents - p.feeCents;
    }
    return buckets;
  }

  async transactions(tutorId: string, limit = 20): Promise<TransactionRow[]> {
    const payments = await this.prisma.payment.findMany({
      where: { tutorId },
      include: { booking: { include: { student: true, subject: true } } },
      take: limit,
      orderBy: { booking: { startTime: 'desc' } },
    });
    return payments.map((p) => ({
      id: p.id,
      date: p.booking.startTime,
      studentName: p.booking.student.fullName,
      subjectName: p.booking.subject.name,
      netCents: p.amountCents - p.feeCents,
      feeCents: p.feeCents,
      status: p.status,
    }));
  }

  /**
   * Withdraw all available (cleared, un-paid-out) earnings into a new payout.
   *
   * When Stripe is configured this moves the net amount from the platform
   * balance to the tutor's Connect account (a real Transfer), and the connected
   * account's own payout schedule settles it to their bank. Without Stripe it
   * falls back to a ledger-only payout so the seeded demo still works.
   */
  async withdraw(tutorId: string): Promise<EarningsSummary> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    const available = await this.prisma.payment.findMany({
      where: { tutorId, status: PaymentStatus.PAID, payoutId: null },
      select: { id: true, amountCents: true, feeCents: true },
    });
    const amount = available.reduce((s, p) => s + (p.amountCents - p.feeCents), 0);
    if (amount <= 0) return this.summary(tutorId);

    let stripeTransferId: string | null = null;
    if (this.stripe.enabled) {
      if (tutor.stripeConnectAccountId === null || !tutor.stripePayoutsEnabled) {
        throw new BadRequestDomainError('Connect payout onboarding is not complete.');
      }
      const transfer = await this.stripe.createTransfer({
        amountCents: amount,
        destination: tutor.stripeConnectAccountId,
        metadata: { tutorId },
      });
      stripeTransferId = transfer.id;
    }

    const payout = await this.prisma.payout.create({
      data: {
        tutorId,
        amountCents: amount,
        status: 'PAID',
        method: tutor.payoutMethod,
        stripeTransferId,
      },
    });
    await this.prisma.payment.updateMany({
      where: { id: { in: available.map((p) => p.id) } },
      data: { payoutId: payout.id },
    });
    return this.summary(tutorId);
  }

  /** Whether the tutor has a Connect account and can receive payouts. */
  async connectStatus(tutorId: string): Promise<ConnectStatus> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    if (tutor.stripeConnectAccountId === null) {
      return { onboarded: false, payoutsEnabled: false };
    }
    if (!this.stripe.enabled) {
      return { onboarded: true, payoutsEnabled: tutor.stripePayoutsEnabled };
    }
    // Refresh from Stripe so status reflects completed onboarding immediately.
    const account = await this.stripe.retrieveAccount(tutor.stripeConnectAccountId);
    const payoutsEnabled = account.payouts_enabled ?? false;
    if (payoutsEnabled !== tutor.stripePayoutsEnabled) {
      await this.prisma.tutor.update({
        where: { id: tutorId },
        data: { stripePayoutsEnabled: payoutsEnabled },
      });
    }
    return { onboarded: true, payoutsEnabled };
  }

  /** Create (or reuse) the tutor's Connect account and return a hosted onboarding link. */
  async startConnectOnboarding(tutorId: string): Promise<string> {
    if (!this.stripe.enabled) {
      throw new BadRequestDomainError('Payouts are not configured.');
    }
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    let accountId = tutor.stripeConnectAccountId;
    if (accountId === null) {
      const account = await this.stripe.createExpressAccount(tutor.email);
      accountId = account.id;
      await this.prisma.tutor.update({
        where: { id: tutorId },
        data: { stripeConnectAccountId: accountId },
      });
    }
    const base = this.config.get<string>('DASHBOARD_URL') ?? 'http://localhost:3100';
    const link = await this.stripe.createAccountLink(
      accountId,
      `${base}/earnings?connect=refresh`,
      `${base}/earnings?connect=return`,
    );
    return link.url;
  }

  async setPayoutSchedule(tutorId: string, schedule: PayoutSchedule): Promise<EarningsSummary> {
    await this.prisma.tutor.update({ where: { id: tutorId }, data: { payoutSchedule: schedule } });
    return this.summary(tutorId);
  }

  async setPayoutMethod(tutorId: string, method: string): Promise<EarningsSummary> {
    await this.prisma.tutor.update({ where: { id: tutorId }, data: { payoutMethod: method } });
    return this.summary(tutorId);
  }
}
