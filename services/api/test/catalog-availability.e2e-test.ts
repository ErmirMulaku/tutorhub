import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { createValidationPipe } from '../src/common/validation.js';
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
    app.useGlobalPipes(createValidationPipe());
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
  const gql = (query: string, t: string, variables?: Record<string, unknown>): request.Test =>
    http().post('/graphql').set('authorization', `Bearer ${t}`).send({ query, variables });

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

  // Sent exactly as both dashboards send it: GraphQL variables with ISO strings.
  const ADD_TIME_OFF = `mutation($input: TimeOffInput!){ addTimeOff(input: $input){ bufferMinutes } }`;

  it('addTimeOff persists a break and removeTimeOff deletes it (regression)', async () => {
    // Used to fail on every real request: the global pipe forbids undecorated
    // properties and TimeOffInput's dates had no class-validator decorator.
    const t = await token(emailA);
    const added = await gql(ADD_TIME_OFF, t, {
      input: {
        label: 'Winter break',
        startDate: '2026-12-24T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
      },
    }).expect(200);
    expect((added.body as { errors?: unknown }).errors).toBeUndefined();

    const list = await gql(
      '{ myAvailability { timeOff { id label startDate endDate } } }',
      t,
    ).expect(200);
    const timeOff = (
      list.body as {
        data: { myAvailability: { timeOff: { id: string; label: string; startDate: string }[] } };
      }
    ).data.myAvailability.timeOff;
    expect(timeOff).toHaveLength(1);
    expect(timeOff[0]?.label).toBe('Winter break');
    expect(timeOff[0]?.startDate).toBe('2026-12-24T00:00:00.000Z');

    await gql(`mutation($id: ID!){ removeTimeOff(id: $id){ bufferMinutes } }`, t, {
      id: timeOff[0]?.id,
    }).expect(200);
    const after = await gql('{ myAvailability { timeOff { id } } }', t).expect(200);
    expect(
      (after.body as { data: { myAvailability: { timeOff: unknown[] } } }).data.myAvailability
        .timeOff,
    ).toHaveLength(0);
  });

  it('addTimeOff rejects a break that ends before it starts', async () => {
    const t = await token(emailA);
    const res = await gql(ADD_TIME_OFF, t, {
      input: {
        label: 'Backwards',
        startDate: '2026-12-31T00:00:00.000Z',
        endDate: '2026-12-24T00:00:00.000Z',
      },
    }).expect(200);
    const body = res.body as { errors?: { message: string; extensions?: { code?: string } }[] };
    expect(body.errors?.[0]?.message).toBe('Time off cannot end before it starts.');
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});
