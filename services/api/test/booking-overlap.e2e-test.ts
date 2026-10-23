import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { BookingService } from '../src/bookings/booking.service.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { createValidationPipe } from '../src/common/validation.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { countOutcomes, fireInParallel } from './helpers/concurrency.js';

const HOUR = 3_600_000;

/** `list[i]`, failing loudly instead of returning `undefined`. */
function at<T>(list: T[], i: number): T {
  const value = list[i];
  if (value === undefined) throw new Error(`No item at index ${i}`);
  return value;
}

/**
 * Double booking (FRESHA_DEPTH_SPEC Block 2). The EXCLUDE constraints in the
 * `booking_no_overlap` migration are the guarantee; these tests hit a real
 * Postgres, because only the real database can show two inserts racing.
 */
describe('Booking overlap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingService;
  const tutors: { id: string; subjectId: string }[] = [];
  const students: string[] = [];
  let day = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingService);

    const stamp = Date.now().toString();
    for (const n of [1, 2]) {
      const tutor = await prisma.tutor.create({
        data: {
          name: `Overlap Tutor ${n}`,
          timezone: 'UTC',
          hourlyCents: 5000,
          workingHours: [],
          email: `overlap-t${n}+${stamp}@example.com`,
        },
      });
      const subject = await prisma.subject.create({
        data: { name: 'Maths', level: 'ADVANCED', tutorId: tutor.id },
      });
      tutors.push({ id: tutor.id, subjectId: subject.id });
    }
    for (let n = 0; n < 20; n++) {
      const student = await prisma.student.create({
        data: { fullName: `Overlap Student ${n}`, email: `overlap-s${n}+${stamp}@example.com` },
      });
      students.push(student.id);
    }
  });

  afterAll(async () => {
    const tutorIds = tutors.map((t) => t.id);
    await prisma.booking.deleteMany({ where: { tutorId: { in: tutorIds } } });
    await prisma.subject.deleteMany({ where: { tutorId: { in: tutorIds } } });
    await prisma.student.deleteMany({ where: { id: { in: students } } });
    await prisma.tutor.deleteMany({ where: { id: { in: tutorIds } } });
    await app.close();
  });

  /** 10:00 UTC on a fresh future day, so tests never collide with each other. */
  function nextDayAt10(): Date {
    day += 1;
    return new Date(Date.UTC(2031, 5, 1, 10) + day * 24 * HOUR);
  }

  function book(
    tutor: number,
    student: number,
    startTime: Date,
  ): ReturnType<BookingService['bookLesson']> {
    const { id, subjectId } = at(tutors, tutor);
    return bookings.bookLesson({ tutorId: id, subjectId, startTime }, at(students, student));
  }

  it('20 students booking the same tutor + slot at once: exactly 1 wins', async () => {
    const start = nextDayAt10();

    const results = await fireInParallel(20, (i) => book(0, i, start));

    expect(countOutcomes(results)).toEqual({ fulfilled: 1, rejected: { SLOT_UNAVAILABLE: 19 } });
    const active = await prisma.booking.count({
      where: {
        tutorId: at(tutors, 0).id,
        startTime: start,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    expect(active).toBe(1);
  });

  it("back-to-back slots don't overlap ('[)': the end is excluded)", async () => {
    const ten = nextDayAt10();
    await book(0, 0, ten);
    await expect(book(0, 1, new Date(ten.getTime() + HOUR))).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('a cancelled booking frees its slot', async () => {
    const start = nextDayAt10();
    const first = await book(0, 0, start);
    await expect(book(0, 1, start)).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    await bookings.cancelForStudent(first.id, at(students, 0));

    await expect(book(0, 1, start)).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('a student cannot book two tutors at the same time', async () => {
    const start = nextDayAt10();
    await book(0, 0, start);

    await expect(book(1, 0, new Date(start.getTime() + HOUR / 2))).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE',
      busy: 'student',
    });
  });

  it("a tutor's own new lesson cannot overlap a student's request", async () => {
    const start = nextDayAt10();
    await book(0, 0, start);

    await expect(
      bookings.createForTutor(at(tutors, 0).id, at(students, 1), at(tutors, 0).subjectId, start),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE', busy: 'tutor' });
  });

  it('rescheduling into an occupied slot is refused; into a free one works', async () => {
    const ten = nextDayAt10();
    await book(0, 0, ten);
    const mine = await book(0, 1, new Date(ten.getTime() + 2 * HOUR)); // 12:00

    await expect(
      bookings.rescheduleForStudent(mine.id, at(students, 1), ten),
    ).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE',
      busy: 'tutor',
    });
    // Moving by 30 minutes overlaps only its own old time — a row never
    // conflicts with itself, so this is allowed.
    const moved = new Date(ten.getTime() + 2.5 * HOUR);
    await expect(
      bookings.rescheduleForStudent(mine.id, at(students, 1), moved),
    ).resolves.toMatchObject({ startTime: moved });
  });

  it('rejects an end before the start instead of a database error', async () => {
    const start = nextDayAt10();
    await expect(
      bookings.create({
        tutorId: at(tutors, 0).id,
        subjectId: at(tutors, 0).subjectId,
        studentId: at(students, 0),
        startTime: start.toISOString(),
        endTime: start.toISOString(),
      }),
    ).rejects.toMatchObject({ name: 'BadRequestDomainError' });
  });

  it('over HTTP, a clash is a 409 with code SLOT_UNAVAILABLE', async () => {
    const start = nextDayAt10();
    const body = (student: number): Record<string, string> => ({
      tutorId: at(tutors, 0).id,
      subjectId: at(tutors, 0).subjectId,
      studentId: at(students, student),
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + HOUR).toISOString(),
    });
    const http = (): request.Agent => request(app.getHttpServer() as Server);

    await http().post('/bookings').send(body(0)).expect(201);
    const res = await http().post('/bookings').send(body(1)).expect(409);

    expect(res.body).toMatchObject({ statusCode: 409, code: 'SLOT_UNAVAILABLE' });
  });
});
