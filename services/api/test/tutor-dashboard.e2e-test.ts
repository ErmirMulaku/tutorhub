import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Tutor-dashboard reads + booking actions are scoped to the signed-in tutor:
 * `tutorBookings` returns only the caller's bookings, `acceptBooking` advances
 * the state machine, and a tutor cannot act on another tutor's booking (404).
 */
describe('Tutor dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { tutorA: '', tutorB: '', student: '', subjectA: '', bookingA: '', bookingB: '' };
  let emailA = '';
  let emailB = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const stamp = Date.now().toString();
    emailA = `dash-a+${stamp}@example.com`;
    emailB = `dash-b+${stamp}@example.com`;
    const tutorA = await prisma.tutor.create({
      data: { name: 'Dash A', timezone: 'UTC', hourlyCents: 5000, workingHours: [], email: emailA },
    });
    const tutorB = await prisma.tutor.create({
      data: { name: 'Dash B', timezone: 'UTC', hourlyCents: 5000, workingHours: [], email: emailB },
    });
    ids.tutorA = tutorA.id;
    ids.tutorB = tutorB.id;
    const subject = await prisma.subject.create({
      data: { name: 'Maths', level: 'ADVANCED', tutorId: tutorA.id },
    });
    ids.subjectA = subject.id;
    const student = await prisma.student.create({
      data: { fullName: 'Dash Student', email: `dash-s+${stamp}@example.com` },
    });
    ids.student = student.id;

    const mk = (tutorId: string, subjectId: string): Promise<{ id: string }> =>
      prisma.booking.create({
        data: {
          tutorId,
          studentId: student.id,
          subjectId,
          startTime: new Date(Date.now() + 86_400_000),
          endTime: new Date(Date.now() + 86_400_000 + 3_600_000),
          status: 'PENDING',
        },
      });
    const subjectB = await prisma.subject.create({
      data: { name: 'Physics', level: 'ADVANCED', tutorId: tutorB.id },
    });
    ids.bookingA = (await mk(tutorA.id, subject.id)).id;
    ids.bookingB = (await mk(tutorB.id, subjectB.id)).id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { id: { in: [ids.bookingA, ids.bookingB] } } });
    await prisma.subject.deleteMany({ where: { tutorId: { in: [ids.tutorA, ids.tutorB] } } });
    await prisma.student.deleteMany({ where: { id: ids.student } });
    await prisma.tutor.deleteMany({ where: { id: { in: [ids.tutorA, ids.tutorB] } } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);
  const tokenFor = async (email: string): Promise<string> => {
    const res = await http().post('/auth/tutor/dev-login').send({ email }).expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };
  const gql = (query: string, token: string): request.Test =>
    http().post('/graphql').set('authorization', `Bearer ${token}`).send({ query });

  it('dashboardSummary returns the tutor KPIs', async () => {
    const res = await gql(
      '{ dashboardSummary { pendingCount unreadMessages } }',
      await tokenFor(emailA),
    ).expect(200);
    const data = res.body as { data: { dashboardSummary: { pendingCount: number } } };
    expect(data.data.dashboardSummary.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it('tutorBookings returns only the caller tutor bookings', async () => {
    const res = await gql('{ tutorBookings { id } }', await tokenFor(emailA)).expect(200);
    const data = res.body as { data: { tutorBookings: { id: string }[] } };
    const returnedIds = data.data.tutorBookings.map((b) => b.id);
    expect(returnedIds).toContain(ids.bookingA);
    expect(returnedIds).not.toContain(ids.bookingB);
  });

  it('acceptBooking advances PENDING → CONFIRMED', async () => {
    const res = await gql(
      `mutation { acceptBooking(id: "${ids.bookingA}") { id status } }`,
      await tokenFor(emailA),
    ).expect(200);
    const data = res.body as { data: { acceptBooking: { status: string } } };
    expect(data.data.acceptBooking.status).toBe('CONFIRMED');
  });

  it("a tutor cannot accept another tutor's booking", async () => {
    const res = await gql(
      `mutation { acceptBooking(id: "${ids.bookingB}") { id } }`,
      await tokenFor(emailA),
    ).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toMatch(/not found|Booking/i);
  });
});
