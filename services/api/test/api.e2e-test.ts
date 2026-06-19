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
  let bookingId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const student = await prisma.student.create({
      data: { fullName: 'E2E Student', email: `e2e+${Date.now().toString()}@example.com` },
    });
    studentId = student.id;
  });

  afterAll(async () => {
    if (bookingId !== '') {
      await prisma.booking.deleteMany({ where: { id: bookingId } });
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
});
