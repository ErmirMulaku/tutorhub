import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { BookingService } from '../src/bookings/booking.service.js';
import { BookingStatus, type Booking } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { countOutcomes, fireInParallel } from './helpers/concurrency.js';

/**
 * Race tests (FRESHA_DEPTH_SPEC Block 1). They fire real calls at the same
 * time against a real Postgres — a mock runs them one by one and cannot race.
 */
describe('Booking races (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingService;
  const ids = { tutor: '', student: '', subject: '' };
  let dayOffset = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingService);

    const stamp = Date.now().toString();
    const tutor = await prisma.tutor.create({
      data: {
        name: 'Race Tutor',
        timezone: 'UTC',
        hourlyCents: 5000,
        workingHours: [],
        email: `race-t+${stamp}@example.com`,
      },
    });
    const student = await prisma.student.create({
      data: { fullName: 'Race Student', email: `race-s+${stamp}@example.com` },
    });
    const subject = await prisma.subject.create({
      data: { name: 'Maths', level: 'ADVANCED', tutorId: tutor.id },
    });
    Object.assign(ids, { tutor: tutor.id, student: student.id, subject: subject.id });
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.booking.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.subject.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.student.deleteMany({ where: { id: ids.student } });
    await prisma.tutor.deleteMany({ where: { id: ids.tutor } });
    await app.close();
  });

  /** A fresh booking on its own day, so tests never share a row. */
  async function makeBooking(status: BookingStatus): Promise<Booking> {
    dayOffset += 1;
    const start = new Date(Date.UTC(2031, 0, 1, 10) + dayOffset * 86_400_000);
    return prisma.booking.create({
      data: {
        tutorId: ids.tutor,
        studentId: ids.student,
        subjectId: ids.subject,
        startTime: start,
        endTime: new Date(start.getTime() + 3_600_000),
        status,
      },
    });
  }

  it('10 parallel accepts + declines on one PENDING booking: exactly 1 wins', async () => {
    const booking = await makeBooking(BookingStatus.PENDING);
    const actions = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 'accept' : 'decline'));

    const results = await fireInParallel(10, (i) =>
      actions[i] === 'accept'
        ? bookings.acceptForTutor(booking.id, ids.tutor)
        : bookings.declineForTutor(booking.id, ids.tutor),
    );

    const outcomes = countOutcomes(results);
    expect(outcomes.fulfilled).toBe(1);
    // Losers either lost the write (CONFLICT) or read the winner's status
    // and were refused by the state machine — never a silent overwrite.
    for (const code of Object.keys(outcomes.rejected)) {
      expect(['CONFLICT', 'InvalidBookingTransitionError']).toContain(code);
    }

    const winner = actions[results.findIndex((r) => r.status === 'fulfilled')];
    const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(final.status).toBe(
      winner === 'accept' ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED,
    );
    expect(final.version).toBe(1);
  });

  it('decline cannot cancel a lesson that was already accepted', async () => {
    const booking = await makeBooking(BookingStatus.PENDING);
    await bookings.acceptForTutor(booking.id, ids.tutor);

    await expect(bookings.declineForTutor(booking.id, ids.tutor)).rejects.toMatchObject({
      name: 'InvalidBookingTransitionError',
    });
    const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(final.status).toBe(BookingStatus.CONFIRMED);
  });

  it('parallel reschedule + cancel never loses an update', async () => {
    // Many rounds, because each round may or may not interleave.
    for (let round = 0; round < 15; round++) {
      const booking = await makeBooking(BookingStatus.CONFIRMED);
      const newStart = new Date(booking.startTime.getTime() + 2 * 3_600_000);

      const [reschedule, cancel] = await Promise.allSettled([
        bookings.rescheduleForStudent(booking.id, ids.student, newStart),
        bookings.cancelForStudent(booking.id, ids.student),
      ]);

      const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      const succeeded = [reschedule, cancel].filter((r) => r.status === 'fulfilled').length;
      // Every successful write bumped the version exactly once: nothing was
      // overwritten by a stale copy.
      expect(final.version).toBe(succeeded);
      if (reschedule.status === 'fulfilled') {
        expect(final.startTime.getTime()).toBe(newStart.getTime());
      } else {
        expect(final.startTime.getTime()).toBe(booking.startTime.getTime());
      }
      if (cancel.status === 'fulfilled') {
        expect(final.status).toBe(BookingStatus.CANCELLED);
      }
    }
  });

  it('a stale reschedule is rejected instead of overwriting a newer change', async () => {
    const booking = await makeBooking(BookingStatus.CONFIRMED);
    // Simulate "someone else wrote after we read": bump the version directly.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { version: { increment: 1 } },
    });
    // The service reads the row itself, so make it read the old copy.
    const findById = bookings.findById.bind(bookings);
    bookings.findById = (): Promise<Booking> => Promise.resolve(booking);
    try {
      await expect(
        bookings.rescheduleForStudent(booking.id, ids.student, new Date(Date.UTC(2032, 0, 1))),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    } finally {
      bookings.findById = findById;
    }
  });

  it('5 parallel reviews of one booking: 1 review row, the rest CONFLICT', async () => {
    const booking = await makeBooking(BookingStatus.COMPLETED);

    const results = await fireInParallel(5, () =>
      bookings.leaveReview(booking.id, ids.student, 5, 'Great'),
    );

    expect(countOutcomes(results)).toEqual({ fulfilled: 1, rejected: { CONFLICT: 4 } });
    expect(await prisma.review.count({ where: { bookingId: booking.id } })).toBe(1);
  });
});
