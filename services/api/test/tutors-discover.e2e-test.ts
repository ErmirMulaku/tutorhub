import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { BookingService } from '../src/bookings/booking.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const HOUR = 3_600_000;

interface Page {
  total: number;
  hasMore: boolean;
  items: { id: string; name: string; rating: number | null }[];
}

/**
 * Discover page (`tutors` query): filtering, sorting by rating or price,
 * counting and paging all happen in Postgres, using the rating aggregates
 * stored on the tutor and kept in step by leaveReview.
 */
describe('Tutors discover (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingService;
  const stamp = Date.now().toString();
  const subject = `Discover${stamp}`; // unique, so the tests see only their tutors
  const tutors: Record<'five' | 'three' | 'none', string> = { five: '', three: '', none: '' };
  let studentId = '';
  let hour = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingService);

    studentId = (
      await prisma.student.create({
        data: { fullName: 'Discover Student', email: `discover-s+${stamp}@example.com` },
      })
    ).id;
    for (const [key, price] of [
      ['five', 9000],
      ['three', 3000],
      ['none', 6000],
    ] as const) {
      const tutor = await prisma.tutor.create({
        data: {
          name: `Discover ${key}`,
          timezone: 'UTC',
          hourlyCents: price,
          workingHours: [],
          email: `discover-${key}+${stamp}@example.com`,
          subjects: { create: { name: subject, level: 'BEGINNER' } },
        },
      });
      tutors[key] = tutor.id;
    }
  });

  afterAll(async () => {
    const ids = Object.values(tutors);
    await prisma.review.deleteMany({ where: { tutorId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { tutorId: { in: ids } } });
    await prisma.subject.deleteMany({ where: { tutorId: { in: ids } } });
    await prisma.student.deleteMany({ where: { id: studentId } });
    await prisma.tutor.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  /** A completed lesson with `tutorId`, ready to be reviewed. */
  async function completedLesson(tutorId: string): Promise<string> {
    hour += 2;
    const start = new Date(Date.UTC(2030, 0, 1) + hour * HOUR);
    const subjectRow = await prisma.subject.findFirstOrThrow({ where: { tutorId } });
    const booking = await prisma.booking.create({
      data: {
        tutorId,
        studentId,
        subjectId: subjectRow.id,
        startTime: start,
        endTime: new Date(start.getTime() + HOUR),
        status: 'COMPLETED',
      },
    });
    return booking.id;
  }

  async function discover(args: string): Promise<Page> {
    const res = await request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({
        query: `{ tutors(subject: "${subject}", ${args}) { total hasMore items { id name rating } } }`,
      })
      .expect(200);
    return (res.body as { data: { tutors: Page } }).data.tutors;
  }

  it('two reviews of one tutor at the same moment both count', async () => {
    const [a, b] = [await completedLesson(tutors.five), await completedLesson(tutors.five)];
    await Promise.all([
      bookings.leaveReview(a, studentId, 5, null),
      bookings.leaveReview(b, studentId, 5, null),
    ]);
    await bookings.leaveReview(await completedLesson(tutors.three), studentId, 3, null);

    const five = await prisma.tutor.findUniqueOrThrow({ where: { id: tutors.five } });
    expect(five).toMatchObject({ ratingSum: 10, ratingCount: 2, ratingAvg: 5 });
  });

  it('sorts by rating (unrated last), filters by minRating, and pages in the database', async () => {
    const all = await discover('limit: 10, offset: 0');
    expect(all.total).toBe(3);
    expect(all.items.map((t) => t.id)).toEqual([tutors.five, tutors.three, tutors.none]);

    const good = await discover('minRating: 4, limit: 10, offset: 0');
    expect(good.items.map((t) => t.id)).toEqual([tutors.five]);

    const second = await discover('limit: 1, offset: 1');
    expect(second).toMatchObject({ total: 3, hasMore: true });
    expect(second.items.map((t) => t.id)).toEqual([tutors.three]);
  });

  it('sorts by price both ways', async () => {
    const asc = await discover('sort: "priceAsc", limit: 10, offset: 0');
    expect(asc.items.map((t) => t.id)).toEqual([tutors.three, tutors.none, tutors.five]);
    const desc = await discover('sort: "priceDesc", limit: 10, offset: 0');
    expect(desc.items.map((t) => t.id)).toEqual([tutors.five, tutors.none, tutors.three]);
  });

  it('an unfiltered page over every tutor returns just that page', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/graphql')
      .send({ query: '{ tutors(limit: 5, offset: 0) { total items { id } } }' })
      .expect(200);
    const page = (res.body as { data: { tutors: { total: number; items: unknown[] } } }).data
      .tutors;
    // Other suites add and remove tutors concurrently, so compare loosely.
    expect(page.total).toBeGreaterThanOrEqual(3);
    expect(page.items).toHaveLength(Math.min(5, page.total));
  });
});
