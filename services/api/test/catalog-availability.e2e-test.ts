import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Catalog + availability self-service, scoped to the signed-in tutor: a tutor
 * sees only their own services and cannot delete another tutor's; working hours
 * and booking rules round-trip through `myAvailability`.
 */
describe('Catalog + availability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { tutorA: '', tutorB: '', serviceB: '' };
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
    emailA = `cat-a+${stamp}@example.com`;
    emailB = `cat-b+${stamp}@example.com`;
    const a = await prisma.tutor.create({
      data: { name: 'Cat A', timezone: 'UTC', hourlyCents: 4000, workingHours: [], email: emailA },
    });
    const b = await prisma.tutor.create({
      data: { name: 'Cat B', timezone: 'UTC', hourlyCents: 4000, workingHours: [], email: emailB },
    });
    ids.tutorA = a.id;
    ids.tutorB = b.id;
    const svcB = await prisma.service.create({
      data: {
        tutorId: b.id,
        name: 'B service',
        type: 'ONE_ON_ONE',
        level: 'ADVANCED',
        priceCents: 5000,
      },
    });
    ids.serviceB = svcB.id;
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { tutorId: { in: [ids.tutorA, ids.tutorB] } } });
    await prisma.timeOff.deleteMany({ where: { tutorId: { in: [ids.tutorA, ids.tutorB] } } });
    await prisma.tutor.deleteMany({ where: { id: { in: [ids.tutorA, ids.tutorB] } } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);
  const token = async (email: string): Promise<string> => {
    const res = await http().post('/auth/tutor/dev-login').send({ email }).expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };
  const gql = (query: string, t: string): request.Test =>
    http().post('/graphql').set('authorization', `Bearer ${t}`).send({ query });

  it('createService then myServices lists only the owner services', async () => {
    const t = await token(emailA);
    await gql(
      `mutation { createService(input: { name: "A maths", type: ONE_ON_ONE, level: ADVANCED, priceCents: 5500, durationMin: 60, lessonsCount: 1 }) { id } }`,
      t,
    ).expect(200);
    const res = await gql('{ myServices { name } }', t).expect(200);
    const data = res.body as { data: { myServices: { name: string }[] } };
    expect(data.data.myServices.map((s) => s.name)).toEqual(['A maths']);
  });

  it("a tutor cannot delete another tutor's service", async () => {
    const res = await gql(
      `mutation { deleteService(id: "${ids.serviceB}") }`,
      await token(emailA),
    ).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toMatch(/not found|Service/i);
  });

  it('updateWorkingHours and updateBookingRules round-trip', async () => {
    const t = await token(emailA);
    await gql(
      `mutation { updateWorkingHours(hours: [{ day: 1, start: "10:00", end: "16:00" }]) { bufferMinutes } }`,
      t,
    ).expect(200);
    await gql(
      `mutation { updateBookingRules(rules: { bufferMinutes: 30, minNoticeHours: 12, maxLessonsPerDay: 4 }) { bufferMinutes } }`,
      t,
    ).expect(200);
    const res = await gql(
      '{ myAvailability { bufferMinutes minNoticeHours maxLessonsPerDay workingHours { day start end } } }',
      t,
    ).expect(200);
    const av = (
      res.body as {
        data: { myAvailability: { bufferMinutes: number; workingHours: { start: string }[] } };
      }
    ).data.myAvailability;
    expect(av.bufferMinutes).toBe(30);
    expect(av.workingHours[0]?.start).toBe('10:00');
  });
});
