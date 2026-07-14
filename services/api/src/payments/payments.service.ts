import { Injectable, Logger } from '@nestjs/common';
import { BadRequestDomainError } from '../common/errors.js';
import { BookingStatus, PaymentStatus } from '../generated/prisma/client.js';
import type Stripe from 'stripe';
import { BookingService } from '../bookings/booking.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StripeService } from '../stripe/stripe.service.js';
import type { BookInput } from '../bookings/dto/book-input.js';

/** Platform commission taken from each lesson charge (net = amount − fee). */
const PLATFORM_FEE_RATE = 0.15;

export interface LessonPaymentIntent {
  clientSecret: string;
  bookingId: string;
  paymentId: string;
}

/**
 * The charge side of the payment loop. When a student books a lesson we create
 * the booking (PENDING) plus a Stripe PaymentIntent, and return its
 * `clientSecret` for the marketplace to confirm the card. The booking is only
 * CONFIRMED once Stripe reports the charge succeeded (via the webhook).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly bookings: BookingService,
  ) {}

  async createLessonPaymentIntent(
    studentId: string,
    input: BookInput,
  ): Promise<LessonPaymentIntent> {
    if (!this.stripe.enabled) {
      throw new BadRequestDomainError('Payments are not configured.');
    }
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: input.tutorId } });
    const amountCents = tutor.hourlyCents;
    if (amountCents <= 0) {
      throw new BadRequestDomainError('This tutor has not set a lesson price yet.');
    }
    const feeCents = Math.round(amountCents * PLATFORM_FEE_RATE);

    // Create the booking first (PENDING) so the intent can reference it.
    const booking = await this.bookings.bookLesson(input, studentId);

    const intent = await this.stripe.createPaymentIntent({
      amountCents,
      metadata: { bookingId: booking.id, tutorId: tutor.id, studentId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amountCents,
        feeCents,
        tutorId: tutor.id,
        status: PaymentStatus.PENDING,
        stripePaymentIntentId: intent.id,
      },
    });

    if (intent.client_secret === null) {
      throw new BadRequestDomainError('Stripe did not return a client secret.');
    }
    return { clientSecret: intent.client_secret, bookingId: booking.id, paymentId: payment.id };
  }

  /** Reconcile a verified Stripe webhook event against our records. */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        await this.markPaymentPaid(intent.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        await this.cancelForFailedIntent(intent.id);
        break;
      }
      case 'account.updated': {
        const account = event.data.object;
        await this.syncConnectAccount(account);
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async markPaymentPaid(intentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: intentId },
    });
    if (payment === null) {
      this.logger.warn(`payment_intent.succeeded for unknown intent ${intentId}`);
      return;
    }
    if (payment.status === PaymentStatus.PAID) return; // idempotent
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PAID },
    });
    await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });
    this.logger.log(`Payment ${payment.id} marked PAID; booking ${payment.bookingId} CONFIRMED.`);
  }

  private async cancelForFailedIntent(intentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: intentId },
    });
    if (payment === null) return;
    await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
    this.logger.log(`Payment ${payment.id} failed; booking ${payment.bookingId} CANCELLED.`);
  }

  private async syncConnectAccount(account: Stripe.Account): Promise<void> {
    const tutor = await this.prisma.tutor.findFirst({
      where: { stripeConnectAccountId: account.id },
    });
    if (tutor === null) return;
    await this.prisma.tutor.update({
      where: { id: tutor.id },
      data: { stripePayoutsEnabled: account.payouts_enabled ?? false },
    });
  }
}
