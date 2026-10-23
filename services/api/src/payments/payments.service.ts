import { Injectable, Logger } from '@nestjs/common';
import { BadRequestDomainError } from '../common/errors.js';
import {
  BookingStatus,
  PaymentStatus,
  type Booking,
  type Prisma,
} from '../generated/prisma/client.js';
import type Stripe from 'stripe';
import { BookingEvents } from '../bookings/booking-events.js';
import { BookingService } from '../bookings/booking.service.js';
import { studentPrincipal } from '../idempotency/idempotency.service.js';
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
    private readonly events: BookingEvents,
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

    // Create the booking first (PENDING) so the intent can reference it. With
    // an idempotency key, a retry gets the same booking back...
    const booking = await this.bookings.bookLesson(input, studentId, input.idempotencyKey);

    // ...and, because Stripe's key is derived from the booking id, the same
    // PaymentIntent too. Creating an intent doesn't move money (the card is
    // only charged when the student confirms it), so if Stripe stays down we
    // release the booking and let the student try again.
    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.createPaymentIntent({
        amountCents,
        metadata: { bookingId: booking.id, tutorId: tutor.id, studentId },
        idempotencyKey: `payment-intent:${booking.id}`,
      });
    } catch (error) {
      await this.releaseBooking(booking.id, studentId, input.idempotencyKey).catch(
        (releaseError: unknown) => {
          this.logger.error(`Could not release booking ${booking.id}: ${String(releaseError)}`);
        },
      );
      throw error;
    }

    // upsert, so a retried request reuses the payment row instead of failing
    // on the one-payment-per-booking unique index.
    const payment = await this.prisma.payment.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
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

  /**
   * Undo a booking whose payment could not be started: cancel it (frees the
   * slot) and forget its idempotency key, in one transaction. Forgetting the
   * key matters: otherwise a retry with the same key would replay the stored
   * "PENDING" booking — which is now cancelled — and could charge for it.
   */
  private async releaseBooking(
    bookingId: string,
    studentId: string,
    idempotencyKey: string | undefined,
  ): Promise<void> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.PENDING },
        data: { status: BookingStatus.CANCELLED, version: { increment: 1 } },
      });
      if (idempotencyKey !== undefined) {
        await tx.idempotencyKey.deleteMany({
          where: { key: idempotencyKey, principal: studentPrincipal(studentId) },
        });
      }
      return count === 1 ? tx.booking.findUniqueOrThrow({ where: { id: bookingId } }) : null;
    });
    if (cancelled !== null) this.events.emit(cancelled);
  }

  /**
   * Reconcile a verified Stripe webhook event against our records.
   *
   * Stripe delivers each event at least once, so the same event can arrive
   * twice — even at the same moment. Everything runs in ONE transaction that
   * starts by recording the event id (primary key): a second delivery inserts
   * 0 rows and stops. Since the record and the changes commit together, a
   * crash half-way leaves neither, and Stripe's redelivery redoes it cleanly.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const changed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.processedStripeEvent.createMany({
        data: [{ eventId: event.id, type: event.type }],
        skipDuplicates: true,
      });
      if (count === 0) {
        this.logger.log(`Stripe event ${event.id} already processed; skipping.`);
        return null;
      }
      return this.applyEvent(tx, event);
    });
    // Tell live clients only after the commit, never about a rolled-back change.
    if (changed !== null) this.events.emit(changed);
  }

  /** Apply one event inside the caller's transaction; returns the changed booking, if any. */
  private async applyEvent(
    tx: Prisma.TransactionClient,
    event: Stripe.Event,
  ): Promise<Booking | null> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return this.markPaymentPaid(tx, event.data.object.id);
      case 'payment_intent.payment_failed':
        return this.cancelForFailedIntent(tx, event.data.object.id);
      case 'account.updated':
        await this.syncConnectAccount(tx, event.data.object);
        return null;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
        return null;
    }
  }

  private async markPaymentPaid(
    tx: Prisma.TransactionClient,
    intentId: string,
  ): Promise<Booking | null> {
    const payment = await tx.payment.findUnique({ where: { stripePaymentIntentId: intentId } });
    if (payment === null) {
      this.logger.warn(`payment_intent.succeeded for unknown intent ${intentId}`);
      return null;
    }
    // Conditional writes: only PENDING → PAID and PENDING → CONFIRMED.
    const paid = await tx.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PAID },
    });
    if (paid.count === 0) return null; // already paid
    const confirmed = await tx.booking.updateMany({
      where: { id: payment.bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.CONFIRMED, version: { increment: 1 } },
    });
    if (confirmed.count === 0) {
      // Paid, but the booking was cancelled meanwhile: needs a refund.
      this.logger.warn(`Payment ${payment.id} PAID but booking ${payment.bookingId} not PENDING.`);
      return null;
    }
    this.logger.log(`Payment ${payment.id} marked PAID; booking ${payment.bookingId} CONFIRMED.`);
    return tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
  }

  private async cancelForFailedIntent(
    tx: Prisma.TransactionClient,
    intentId: string,
  ): Promise<Booking | null> {
    const payment = await tx.payment.findUnique({ where: { stripePaymentIntentId: intentId } });
    if (payment === null) return null;
    // Only an unpaid request is cancelled — never a lesson that is already confirmed.
    const { count } = await tx.booking.updateMany({
      where: { id: payment.bookingId, status: BookingStatus.PENDING },
      data: { status: BookingStatus.CANCELLED, version: { increment: 1 } },
    });
    if (count === 0) return null;
    this.logger.log(`Payment ${payment.id} failed; booking ${payment.bookingId} CANCELLED.`);
    return tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
  }

  private async syncConnectAccount(
    tx: Prisma.TransactionClient,
    account: Stripe.Account,
  ): Promise<void> {
    const tutor = await tx.tutor.findFirst({
      where: { stripeConnectAccountId: account.id },
    });
    if (tutor === null) return;
    await tx.tutor.update({
      where: { id: tutor.id },
      data: { stripePayoutsEnabled: account.payouts_enabled ?? false },
    });
  }
}
