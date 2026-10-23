import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type Stripe from 'stripe';
import { AppModule } from '../src/app.module.js';
import { BookingService } from '../src/bookings/booking.service.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { createValidationPipe } from '../src/common/validation.js';
import { IdempotencyService } from '../src/idempotency/idempotency.service.js';
import { PaymentsService } from '../src/payments/payments.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { StripeService } from '../src/stripe/stripe.service.js';
import { WalletService } from '../src/wallet/wallet.service.js';
import { countOutcomes, fireInParallel } from './helpers/concurrency.js';

const HOUR = 3_600_000;

/** A Stripe stand-in: no network, and each test decides whether it's "down". */
const fakeStripe = {
  enabled: true,
  down: false,
  intents: 0,
  createPaymentIntent(params: { idempotencyKey: string }): Promise<{
    id: string;
    client_secret: string;
  }> {
    if (this.down) return Promise.reject(new Error('Stripe timed out'));
    this.intents += 1;
    return Promise.resolve({ id: `pi_${params.idempotencyKey}`, client_secret: 'secret' });
  },
};

/** Idempotency keys, Stripe webhook dedupe, wallet redeem (FRESHA_DEPTH_SPEC Block 3). */
describe('Idempotency and partial failures (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingService;
  const ids = { tutor: '', subject: '', students: [] as string[] };
  let day = 0;
  const stamp = Date.now().toString();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StripeService)
      .useValue(fakeStripe)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingService);

    const tutor = await prisma.tutor.create({
      data: {
        name: 'Idem Tutor',
        timezone: 'UTC',
        hourlyCents: 5000,
        workingHours: [],
        email: `idem-t+${stamp}@example.com`,
      },
    });
    const subject = await prisma.subject.create({
      data: { name: 'Maths', level: 'ADVANCED', tutorId: tutor.id },
    });
    ids.tutor = tutor.id;
    ids.subject = subject.id;
    for (let n = 0; n < 6; n++) {
      const student = await prisma.student.create({
        data: { fullName: `Idem Student ${n}`, email: `idem-s${n}+${stamp}@example.com` },
      });
      ids.students.push(student.id);
    }
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { key: { startsWith: `test-${stamp}` } } });
    await prisma.processedStripeEvent.deleteMany({
      where: { eventId: { startsWith: `evt_${stamp}` } },
    });
    await prisma.$executeRaw`DROP TRIGGER IF EXISTS test_fail_booking_update ON "Booking"`;
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS test_fail_booking_update()`;
    await prisma.booking.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.giftCard.deleteMany({ where: { code: { startsWith: `TEST-${stamp}` } } });
    await prisma.subject.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
    await prisma.tutor.deleteMany({ where: { id: ids.tutor } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);
  const student = (n: number): string => {
    const id = ids.students[n];
    if (id === undefined) throw new Error(`No student ${n}`);
    return id;
  };
  const key = (name: string): string => `test-${stamp}-${name}`;

  function nextSlot(): { startTime: string; endTime: string } {
    day += 1;
    const start = new Date(Date.UTC(2032, 0, 1, 10) + day * 24 * HOUR);
    return {
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + HOUR).toISOString(),
    };
  }

  function bookingBody(n: number, slot = nextSlot()): Record<string, string> {
    return { tutorId: ids.tutor, subjectId: ids.subject, studentId: student(n), ...slot };
  }

  describe('3a. Idempotency-Key on POST /bookings', () => {
    it('the same key sent 5 times at once creates 1 booking; all get the same response', async () => {
      const body = bookingBody(0);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          http().post('/bookings').set('Idempotency-Key', key('parallel')).send(body),
        ),
      );

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      const bodies = responses.map((r) => JSON.stringify(r.body));
      expect(new Set(bodies).size).toBe(1);
      const count = await prisma.booking.count({
        where: { tutorId: ids.tutor, startTime: new Date(body.startTime ?? '') },
      });
      expect(count).toBe(1);

      const metrics = await http().get('/metrics').expect(200);
      expect(metrics.text).toMatch(/idempotent_replays_total\{[^}]*\} [1-9]/);
    });

    it('the same key with a different body is a 422', async () => {
      await http()
        .post('/bookings')
        .set('Idempotency-Key', key('reused'))
        .send(bookingBody(1))
        .expect(201);

      const res = await http()
        .post('/bookings')
        .set('Idempotency-Key', key('reused'))
        .send(bookingBody(1))
        .expect(422);
      expect(res.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    });

    it('without a key nothing changes: no key row, a second identical request is a clash', async () => {
      const body = bookingBody(2);
      await http().post('/bookings').send(body).expect(201);
      const res = await http().post('/bookings').send(body).expect(409);
      expect(res.body).toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    });

    it('GraphQL/gRPC path: bookLesson with the same key returns the same booking', async () => {
      const slot = nextSlot();
      const input = {
        tutorId: ids.tutor,
        subjectId: ids.subject,
        startTime: new Date(slot.startTime),
      };
      const first = await bookings.bookLesson(input, student(3), key('book-lesson'));
      const retry = await bookings.bookLesson(input, student(3), key('book-lesson'));
      expect(retry).toEqual(first);
    });

    it('expired keys are deleted by cleanup; live ones stay', async () => {
      const past = new Date(Date.now() - HOUR);
      const future = new Date(Date.now() + HOUR);
      await prisma.idempotencyKey.createMany({
        data: [
          { key: key('expired'), principal: 'p', requestHash: 'h', expiresAt: past },
          { key: key('live'), principal: 'p', requestHash: 'h', expiresAt: future },
        ],
      });

      const deleted = await app.get(IdempotencyService).deleteExpired();

      expect(deleted).toBeGreaterThanOrEqual(1);
      expect(await prisma.idempotencyKey.findUnique({ where: { key: key('expired') } })).toBeNull();
      expect(
        await prisma.idempotencyKey.findUnique({ where: { key: key('live') } }),
      ).not.toBeNull();
    });
  });

  describe('3b. Stripe webhook', () => {
    async function pendingPaidBooking(): Promise<{ bookingId: string; intentId: string }> {
      const slot = nextSlot();
      const booking = await prisma.booking.create({
        data: {
          tutorId: ids.tutor,
          subjectId: ids.subject,
          studentId: student(4),
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
        },
      });
      const intentId = `pi_${stamp}_${day}`;
      await prisma.payment.create({
        data: { bookingId: booking.id, amountCents: 5000, stripePaymentIntentId: intentId },
      });
      return { bookingId: booking.id, intentId };
    }

    function succeeded(eventId: string, intentId: string): Stripe.Event {
      return {
        id: eventId,
        type: 'payment_intent.succeeded',
        data: { object: { id: intentId } },
      } as unknown as Stripe.Event;
    }

    it('the same event delivered 3 times at once is applied once', async () => {
      const { bookingId, intentId } = await pendingPaidBooking();
      const event = succeeded(`evt_${stamp}_dup`, intentId);
      const payments = app.get(PaymentsService);

      const results = await fireInParallel(3, () => payments.handleWebhookEvent(event));

      expect(countOutcomes(results)).toEqual({ fulfilled: 3, rejected: {} });
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.version).toBe(1);
      const payment = await prisma.payment.findUniqueOrThrow({ where: { bookingId } });
      expect(payment.status).toBe('PAID');
      expect(await prisma.processedStripeEvent.count({ where: { eventId: event.id } })).toBe(1);
    });

    it('a crash between the payment and booking updates leaves nothing half-applied', async () => {
      const { bookingId, intentId } = await pendingPaidBooking();
      // Make the database itself fail the booking update — a real error half-way
      // through the transaction, after the payment row was already updated.
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_fail_booking_update() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'simulated crash'; END $$ LANGUAGE plpgsql`;
      await prisma.$executeRaw`
        CREATE TRIGGER test_fail_booking_update BEFORE UPDATE ON "Booking"
        FOR EACH ROW WHEN (OLD."startTime" >= '2032-01-01' AND OLD."startTime" < '2033-01-01'
                           AND OLD.status = 'PENDING' AND NEW.status = 'CONFIRMED')
        EXECUTE FUNCTION test_fail_booking_update()`;
      const event = succeeded(`evt_${stamp}_crash`, intentId);
      const payments = app.get(PaymentsService);

      try {
        await expect(payments.handleWebhookEvent(event)).rejects.toThrow();
        expect((await prisma.payment.findUniqueOrThrow({ where: { bookingId } })).status).toBe(
          'PENDING',
        );
        expect(await prisma.processedStripeEvent.count({ where: { eventId: event.id } })).toBe(0);
      } finally {
        await prisma.$executeRaw`DROP TRIGGER IF EXISTS test_fail_booking_update ON "Booking"`;
      }

      // Stripe redelivers; this time it goes through.
      await payments.handleWebhookEvent(event);
      expect((await prisma.payment.findUniqueOrThrow({ where: { bookingId } })).status).toBe(
        'PAID',
      );
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe(
        'CONFIRMED',
      );
    });
  });

  describe('3c. Wallet redeem', () => {
    it('5 parallel redeems of one card credit the wallet exactly once', async () => {
      const card = await prisma.giftCard.create({
        data: { code: `TEST-${stamp}-CARD`, amountCents: 2500, balanceCents: 2500 },
      });
      const wallet = app.get(WalletService);
      const before = (await prisma.student.findUniqueOrThrow({ where: { id: student(5) } }))
        .walletCents;

      const results = await fireInParallel(5, () => wallet.redeem(student(5), card.code));

      const outcomes = countOutcomes(results);
      expect(outcomes.fulfilled).toBe(1);
      for (const code of Object.keys(outcomes.rejected)) {
        expect(['CONFLICT', 'BadRequestDomainError']).toContain(code);
      }
      const after = (await prisma.student.findUniqueOrThrow({ where: { id: student(5) } }))
        .walletCents;
      expect(after - before).toBe(2500);
    });
  });

  describe('3d. Paid booking when Stripe is down', () => {
    it('releases the booking and its key, so a retry with the same key starts fresh', async () => {
      const payments = app.get(PaymentsService);
      const slot = nextSlot();
      const input = {
        tutorId: ids.tutor,
        subjectId: ids.subject,
        startTime: new Date(slot.startTime),
        idempotencyKey: key('paid'),
      };

      fakeStripe.down = true;
      await expect(payments.createLessonPaymentIntent(student(4), input)).rejects.toThrow(
        'Stripe timed out',
      );
      const failed = await prisma.booking.findFirstOrThrow({
        where: { tutorId: ids.tutor, startTime: input.startTime },
      });
      expect(failed.status).toBe('CANCELLED');
      expect(
        await prisma.idempotencyKey.findUnique({ where: { key: input.idempotencyKey } }),
      ).toBeNull();

      fakeStripe.down = false;
      const first = await payments.createLessonPaymentIntent(student(4), input);
      const retry = await payments.createLessonPaymentIntent(student(4), input);

      expect(first.bookingId).not.toBe(failed.id);
      expect(retry).toEqual(first); // same booking, same intent, same payment row
      expect(await prisma.payment.count({ where: { bookingId: first.bookingId } })).toBe(1);
    });
  });
});
