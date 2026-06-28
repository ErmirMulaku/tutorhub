import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Marketing, scoped to the tutor: create/list promotions, the summary counts
 * active promos, and a tutor cannot end another tutor's promotion.
 */
describe('Marketing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { tutorA: '', tutorB: '', promoB: '' };
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
    emailA = `mkt-a+${stamp}@example.com`;
    emailB = `mkt-b+${stamp}@example.com`;
    const a = await prisma.tutor.create({
      data: { name: 'Mkt A', timezone: 'UTC', hourlyCents: 4000, workingHours: [], email: emailA },
    });
    const b = await prisma.tutor.create({
      data: { name: 'Mkt B', timezone: 'UTC', hourlyCents: 4000, workingHours: [], email: emailB },
    });
    ids.tutorA = a.id;
    ids.tutorB = b.id;
    const promoB = await prisma.promotion.create({
      data: {
        tutorId: b.id,
        name: 'B promo',
        code: `BPROMO${stamp}`,
        discountValue: 10,
        state: 'ACTIVE',
      },
    });
    ids.promoB = promoB.id;
  });

  afterAll(async () => {
    await prisma.promotion.deleteMany({ where: { tutorId: { in: [ids.tutorA, ids.tutorB] } } });
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

  it('createPromotion then summary counts it as active', async () => {
    const t = await token(emailA);
    await gql(
      `mutation { createPromotion(input: { name: "A promo", code: "APROMO", discountType: PERCENT, discountValue: 20 }) { id } }`,
      t,
    ).expect(200);
    const res = await gql(
      '{ marketingSummary { activePromotions } promotions { code } }',
      t,
    ).expect(200);
    const data = res.body as {
      data: { marketingSummary: { activePromotions: number }; promotions: { code: string }[] };
    };
    expect(data.data.marketingSummary.activePromotions).toBe(1);
    expect(data.data.promotions.map((p) => p.code)).toContain('APROMO');
  });

  it("a tutor cannot end another tutor's promotion", async () => {
    const res = await gql(
      `mutation { endPromotion(id: "${ids.promoB}") { id } }`,
      await token(emailA),
    ).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toMatch(/not found|Promotion/i);
  });

  it('referralProgram is created on first read', async () => {
    const res = await gql(
      '{ referralProgram { creditCents referredCount } }',
      await token(emailA),
    ).expect(200);
    const ref = (res.body as { data: { referralProgram: { creditCents: number } } }).data
      .referralProgram;
    expect(ref.creditCents).toBeGreaterThan(0);
  });
});
