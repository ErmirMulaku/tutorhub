import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

interface IdResponse {
  id: string;
}
interface BookingResponse {
  id: string;
  status: string;
}

/**
 * End-to-end tests against a real Postgres. They create and then delete their
 * own data (scoped cleanup), so they are safe to run against a seeded dev DB.
 */
describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tutorId = '';
  let subjectId = '';
  let studentId = '';
  let studentEmail = '';
  let bookingId = '';
  let token = '';
  let gqlBookingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    studentEmail = `e2e+${Date.now().toString()}@example.com`;
    const student = await prisma.student.create({
      data: { fullName: 'E2E Student', email: studentEmail },
    });
    studentId = student.id;
  });

  afterAll(async () => {
    for (const id of [bookingId, gqlBookingId]) {
      if (id !== '') {
        await prisma.booking.deleteMany({ where: { id } }); // cascades its review
      }
    }
    if (subjectId !== '') {
      await prisma.subject.deleteMany({ where: { id: subjectId } });
    }
    if (tutorId !== '') {
      await prisma.tutor.deleteMany({ where: { id: tutorId } });
    }
    if (studentId !== '') {
      await prisma.student.deleteMany({ where: { id: studentId } });
    }
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);

  it('GET /health → ok', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /tutors creates a tutor', async () => {
    const res = await http()
      .post('/tutors')
      .send({
        name: 'E2E Tutor',
        timezone: 'Europe/Belgrade',
        hourlyCents: 3500,
        workingHours: [{ day: 1, start: '09:00', end: '17:00' }],
      })
      .expect(201);
    tutorId = (res.body as IdResponse).id;
    expect(tutorId).toMatch(/[0-9a-f-]{36}/);
  });

  it('rejects an invalid tutor payload with 400', async () => {
    await http().post('/tutors').send({ name: '' }).expect(400);
  });

  it('POST /subjects creates a subject for the tutor', async () => {
    const res = await http()
      .post('/subjects')
      .send({ name: 'E2E Guitar', level: 'BEGINNER', tutorId })
      .expect(201);
    subjectId = (res.body as IdResponse).id;
  });

  it('returns 404 when creating a subject for a missing tutor', async () => {
    await http()
      .post('/subjects')
      .send({ name: 'X', level: 'BEGINNER', tutorId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('POST /bookings creates a PENDING booking', async () => {
    const res = await http()
      .post('/bookings')
      .send({
        tutorId,
        studentId,
        subjectId,
        startTime: '2025-06-02T09:00:00.000Z',
        endTime: '2025-06-02T10:00:00.000Z',
      })
      .expect(201);
    const booking = res.body as BookingResponse;
    bookingId = booking.id;
    expect(booking.status).toBe('PENDING');
  });

  it('walks the booking through a valid lifecycle', async () => {
    await http().patch(`/bookings/${bookingId}/status`).send({ status: 'CONFIRMED' }).expect(200);
    const res = await http()
      .patch(`/bookings/${bookingId}/status`)
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect((res.body as BookingResponse).status).toBe('COMPLETED');
  });

  it('rejects an illegal transition with 409', async () => {
    await http().patch(`/bookings/${bookingId}/status`).send({ status: 'PENDING' }).expect(409);
  });

  it('returns 404 for an unknown booking', async () => {
    await http().get('/bookings/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GraphQL availability uses the slot engine (Mon 09:00–17:00 → 8 future slots)', async () => {
    // A Monday ~2 weeks out (future, so nothing is filtered by lead time) with
    // no bookings for this tutor → eight 1-hour slots, regardless of season.
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 14);
    while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
    const day = date.toISOString().slice(0, 10);

    const query = `{ availability(tutorId: "${tutorId}", date: "${day}") { start end } }`;
    const res = await http().post('/graphql').send({ query }).expect(200);
    const slots = (res.body as { data: { availability: { start: string; end: string }[] } }).data
      .availability;
    expect(slots).toHaveLength(8);
    const first = slots[0];
    expect(first).toBeDefined();
    if (first !== undefined) {
      const durationMs = new Date(first.end).getTime() - new Date(first.start).getTime();
      expect(durationMs).toBe(60 * 60 * 1000);
    }
  });

  it('dev-login mints a JWT and the guarded `me` query returns the student', async () => {
    const login = await http().post('/auth/dev-login').send({ email: studentEmail }).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
    expect(token).toEqual(expect.any(String));

    const res = await http()
      .post('/graphql')
      .set('authorization', `Bearer ${token}`)
      .send({ query: '{ me { id email } }' })
      .expect(200);
    const me = (res.body as { data: { me: { id: string; email: string } } }).data.me;
    expect(me.id).toBe(studentId);
    expect(me.email).toBe(studentEmail);
  });

  it('rejects the `me` query without a token', async () => {
    const res = await http().post('/graphql').send({ query: '{ me { id } }' }).expect(200);
    const body = res.body as { data: unknown; errors: unknown[] };
    expect(body.data).toBeNull();
    expect(body.errors).toBeDefined();
  });

  it('bookLesson mutation creates a PENDING booking for the current student', async () => {
    const mutation = `mutation {
      bookLesson(input: { tutorId: "${tutorId}", subjectId: "${subjectId}", startTime: "2025-07-07T09:00:00.000Z" }) {
        id status student { id } tutor { id }
      }
    }`;
    const res = await http()
      .post('/graphql')
      .set('authorization', `Bearer ${token}`)
      .send({ query: mutation })
      .expect(200);
    const booking = (
      res.body as {
        data: { bookLesson: { id: string; status: string; student: { id: string } } };
      }
    ).data.bookLesson;
    gqlBookingId = booking.id;
    expect(booking.status).toBe('PENDING');
    expect(booking.student.id).toBe(studentId);
  });

  it('myBookings returns the current student bookings', async () => {
    const res = await http()
      .post('/graphql')
      .set('authorization', `Bearer ${token}`)
      .send({ query: '{ myBookings { id } }' })
      .expect(200);
    const ids = (res.body as { data: { myBookings: { id: string }[] } }).data.myBookings.map(
      (b) => b.id,
    );
    expect(ids).toContain(gqlBookingId);
  });

  it('leaveReview works once the booking is COMPLETED (cross-transport)', async () => {
    // Drive the GraphQL-created booking to COMPLETED over REST, then review it.
    await http()
      .patch(`/bookings/${gqlBookingId}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    await http()
      .patch(`/bookings/${gqlBookingId}/status`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const mutation = `mutation {
      leaveReview(bookingId: "${gqlBookingId}", rating: 5, comment: "Great") { id rating comment }
    }`;
    const res = await http()
      .post('/graphql')
      .set('authorization', `Bearer ${token}`)
      .send({ query: mutation })
      .expect(200);
    const review = (res.body as { data: { leaveReview: { rating: number } } }).data.leaveReview;
    expect(review.rating).toBe(5);
  });

  it('rejects bookLesson without a token', async () => {
    const mutation = `mutation {
      bookLesson(input: { tutorId: "${tutorId}", subjectId: "${subjectId}", startTime: "2025-07-08T09:00:00.000Z" }) { id }
    }`;
    const res = await http().post('/graphql').send({ query: mutation }).expect(200);
    expect((res.body as { errors: unknown[] }).errors).toBeDefined();
  });
});
