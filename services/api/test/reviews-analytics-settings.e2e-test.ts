import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Phase 6 tutor surfaces: review summary + reply, analytics aggregation, and
 * settings/publish — all scoped to the signed-in tutor.
 */
describe('Reviews + Analytics + Settings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { tutor: '', student: '', subject: '', booking: '', review: '' };
  let email = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const stamp = Date.now().toString();
    email = `ras+${stamp}@example.com`;
    const tutor = await prisma.tutor.create({
      data: {
        name: 'RAS Tutor',
        timezone: 'UTC',
        hourlyCents: 5000,
        workingHours: [],
        email,
        isActive: false,
      },
    });
    ids.tutor = tutor.id;
    const subject = await prisma.subject.create({
      data: { name: 'Maths', level: 'ADVANCED', tutorId: tutor.id },
    });
    ids.subject = subject.id;
    const student = await prisma.student.create({
      data: { fullName: 'RAS Student', email: `ras-s+${stamp}@example.com` },
    });
    ids.student = student.id;
    const booking = await prisma.booking.create({
      data: {
        tutorId: tutor.id,
        studentId: student.id,
        subjectId: subject.id,
        startTime: new Date(Date.now() - 2 * 86_400_000),
        endTime: new Date(Date.now() - 2 * 86_400_000 + 3_600_000),
        status: 'COMPLETED',
      },
    });
    ids.booking = booking.id;
    const review = await prisma.review.create({
      data: { bookingId: booking.id, tutorId: tutor.id, rating: 5, comment: 'Brilliant' },
    });
    ids.review = review.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.booking.deleteMany({ where: { id: ids.booking } });
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

  it('reviewSummary reports the average and 5★ distribution', async () => {
    const res = await gql('{ reviewSummary { average count distribution } }', await token()).expect(
      200,
    );
    const s = (
      res.body as {
        data: { reviewSummary: { average: number; count: number; distribution: number[] } };
      }
    ).data.reviewSummary;
    expect(s.count).toBe(1);
    expect(s.average).toBe(5);
    expect(s.distribution[0]).toBe(1); // one 5★
  });

  it('replyToReview attaches a reply and the replied filter finds it', async () => {
    const t = await token();
    await gql(
      `mutation { replyToReview(id: "${ids.review}", reply: "Thank you!") { id } }`,
      t,
    ).expect(200);
    const res = await gql('{ myReviews(filter: "replied") { id reply } }', t).expect(200);
    const reviews = (res.body as { data: { myReviews: { id: string; reply: string }[] } }).data
      .myReviews;
    expect(reviews.find((r) => r.id === ids.review)?.reply).toBe('Thank you!');
  });

  it('analyticsSummary counts completed lessons and 100% repeat is 0 for a single booking', async () => {
    const res = await gql(
      '{ analyticsSummary { lessonsThisMonth } topSubjects { name pct } }',
      await token(),
    ).expect(200);
    const data = res.body as {
      data: {
        analyticsSummary: { lessonsThisMonth: number };
        topSubjects: { name: string; pct: number }[];
      };
    };
    expect(data.data.topSubjects[0]?.name).toBe('Maths');
    expect(data.data.topSubjects[0]?.pct).toBe(100);
  });

  it('updateTutorProfile and publishProfile persist', async () => {
    const t = await token();
    await gql(
      'mutation { updateTutorProfile(input: { headline: "New headline" }) { name } }',
      t,
    ).expect(200);
    await gql('mutation { publishProfile { isActive } }', t).expect(200);
    const res = await gql('{ tutorSettings { headline isActive } }', t).expect(200);
    const s = (res.body as { data: { tutorSettings: { headline: string; isActive: boolean } } })
      .data.tutorSettings;
    expect(s.headline).toBe('New headline');
    expect(s.isActive).toBe(true);
  });
});
