import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Tutor-initiated booking + notification feed, scoped to the signed-in tutor:
 * createLesson books a CONFIRMED lesson (and rejects another tutor's subject),
 * myStudents lists the tutor's students, and a PENDING booking surfaces as a
 * notification.
 */
describe('New lesson + notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = { tutorA: '', tutorB: '', student: '', subjectA: '', subjectB: '' };
  let emailA = '';
  const created: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const stamp = Date.now().toString();
    emailA = `nl-a+${stamp}@example.com`;
    const a = await prisma.tutor.create({
      data: { name: 'NL A', timezone: 'UTC', hourlyCents: 5000, workingHours: [], email: emailA },
    });
    const b = await prisma.tutor.create({
      data: {
        name: 'NL B',
        timezone: 'UTC',
        hourlyCents: 5000,
        workingHours: [],
        email: `nl-b+${stamp}@example.com`,
      },
    });
    ids.tutorA = a.id;
    ids.tutorB = b.id;
    ids.subjectA = (
      await prisma.subject.create({ data: { name: 'Maths', level: 'ADVANCED', tutorId: a.id } })
    ).id;
    ids.subjectB = (
      await prisma.subject.create({ data: { name: 'Physics', level: 'ADVANCED', tutorId: b.id } })
    ).id;
    const student = await prisma.student.create({
      data: { fullName: 'NL Student', email: `nl-s+${stamp}@example.com` },
    });
    ids.student = student.id;
    // A pending booking so the notification feed has a booking request.
    created.push(
      (
        await prisma.booking.create({
          data: {
            tutorId: a.id,
            studentId: student.id,
            subjectId: ids.subjectA,
            startTime: new Date(Date.now() + 86_400_000),
            endTime: new Date(Date.now() + 86_400_000 + 3_600_000),
            status: 'PENDING',
          },
        })
      ).id,
    );
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { tutorId: { in: [ids.tutorA, ids.tutorB] } } });
    await prisma.subject.deleteMany({ where: { tutorId: { in: [ids.tutorA, ids.tutorB] } } });
    await prisma.student.deleteMany({ where: { id: ids.student } });
    await prisma.tutor.deleteMany({ where: { id: { in: [ids.tutorA, ids.tutorB] } } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);
  const token = async (): Promise<string> => {
    const res = await http().post('/auth/tutor/dev-login').send({ email: emailA }).expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };
  const gql = (query: string, t: string): request.Test =>
    http().post('/graphql').set('authorization', `Bearer ${t}`).send({ query });

  it('myStudents lists the tutor students', async () => {
    const res = await gql('{ myStudents { fullName } }', await token()).expect(200);
    const names = (
      res.body as { data: { myStudents: { fullName: string }[] } }
    ).data.myStudents.map((s) => s.fullName);
    expect(names).toContain('NL Student');
  });

  it('createLesson books a CONFIRMED lesson', async () => {
    const res = await gql(
      `mutation { createLesson(studentId: "${ids.student}", subjectId: "${ids.subjectA}", startTime: "2026-07-15T14:00:00.000Z") { id status } }`,
      await token(),
    ).expect(200);
    const lesson = (res.body as { data: { createLesson: { id: string; status: string } } }).data
      .createLesson;
    created.push(lesson.id);
    expect(lesson.status).toBe('CONFIRMED');
  });

  it("rejects another tutor's subject", async () => {
    const res = await gql(
      `mutation { createLesson(studentId: "${ids.student}", subjectId: "${ids.subjectB}", startTime: "2026-07-16T14:00:00.000Z") { id } }`,
      await token(),
    ).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toMatch(/not found|Subject/i);
  });

  it('tutorNotifications surfaces the pending booking request', async () => {
    const res = await gql('{ tutorNotifications { type title } }', await token()).expect(200);
    const notifs = (res.body as { data: { tutorNotifications: { type: string; title: string }[] } })
      .data.tutorNotifications;
    expect(notifs.some((n) => n.type === 'booking' && n.title.includes('NL Student'))).toBe(true);
  });
});
