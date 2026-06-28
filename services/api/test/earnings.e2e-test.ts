import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Earnings aggregation + payout, scoped to the tutor: available/lifetime sum net
 * of the tutor's PAID payments, and `withdraw` sweeps available to zero.
 */
describe('Earnings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { tutor: '', student: '', subject: '', bookings: [] as string[] };
  let email = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const stamp = Date.now().toString();
    email = `earn+${stamp}@example.com`;
    const tutor = await prisma.tutor.create({
      data: {
        name: 'Earn Tutor',
        timezone: 'UTC',
        hourlyCents: 5000,
        workingHours: [],
        email,
        payoutMethod: 'Visa •••• 0000',
      },
    });
    ids.tutor = tutor.id;
    const subject = await prisma.subject.create({
      data: { name: 'Maths', level: 'ADVANCED', tutorId: tutor.id },
    });
    ids.subject = subject.id;
    const student = await prisma.student.create({
      data: { fullName: 'Earn Student', email: `earn-s+${stamp}@example.com` },
    });
    ids.student = student.id;

    // Two PAID payments (available) + one PENDING (clearing).
    for (const [i, status] of (['PAID', 'PAID', 'PENDING'] as const).entries()) {
      const b = await prisma.booking.create({
        data: {
          tutorId: tutor.id,
          studentId: student.id,
          subjectId: subject.id,
          startTime: new Date(Date.now() - (i + 1) * 86_400_000),
          endTime: new Date(Date.now() - (i + 1) * 86_400_000 + 3_600_000),
          status: 'COMPLETED',
        },
      });
      ids.bookings.push(b.id);
      await prisma.payment.create({
        data: { bookingId: b.id, tutorId: tutor.id, amountCents: 5000, feeCents: 500, status },
      });
    }
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.payout.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.booking.deleteMany({ where: { id: { in: ids.bookings } } });
    await prisma.subject.deleteMany({ where: { id: ids.subject } });
    await prisma.student.deleteMany({ where: { id: ids.student } });
    await prisma.tutor.deleteMany({ where: { id: ids.tutor } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);
  const token = async (): Promise<string> => {
    const res = await http().post('/auth/tutor/dev-login').send({ email }).expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };
  const gql = (query: string, t: string): request.Test =>
    http().post('/graphql').set('authorization', `Bearer ${t}`).send({ query });

  it('summary sums net of PAID (available) and PENDING (clearing)', async () => {
    const res = await gql(
      '{ earningsSummary { availableCents pendingCents lifetimeCents } }',
      await token(),
    ).expect(200);
    const s = (
      res.body as {
        data: {
          earningsSummary: { availableCents: number; pendingCents: number; lifetimeCents: number };
        };
      }
    ).data.earningsSummary;
    expect(s.availableCents).toBe(9000); // 2 × (5000 − 500)
    expect(s.pendingCents).toBe(4500);
    expect(s.lifetimeCents).toBe(9000);
  });

  it('byMonth returns 8 buckets', async () => {
    const res = await gql('{ earningsByMonth { month netCents } }', await token()).expect(200);
    expect(
      (res.body as { data: { earningsByMonth: unknown[] } }).data.earningsByMonth,
    ).toHaveLength(8);
  });

  it('withdraw sweeps available to zero', async () => {
    const t = await token();
    await gql('mutation { withdraw { availableCents } }', t).expect(200);
    const res = await gql('{ earningsSummary { availableCents lifetimeCents } }', t).expect(200);
    const s = (
      res.body as { data: { earningsSummary: { availableCents: number; lifetimeCents: number } } }
    ).data.earningsSummary;
    expect(s.availableCents).toBe(0);
    expect(s.lifetimeCents).toBe(9000); // lifetime unchanged (paid out still counts)
  });
});
