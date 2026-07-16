import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Tutor (dashboard) authentication: dev-login + password sign-in mint `kind:tutor`
 * tokens, the tutor guard rejects student tokens, and the student guard rejects
 * tutor tokens. Creates and deletes its own tutor (safe against a seeded DB).
 */
describe('Tutor auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tutorId = '';
  let studentId = '';
  let tutorEmail = '';
  let studentEmail = '';
  let signupEmail = '';
  let signupTutorId = '';
  let signupCode = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const stamp = Date.now().toString();
    tutorEmail = `e2e-tutor+${stamp}@example.com`;
    studentEmail = `e2e-student+${stamp}@example.com`;
    const tutor = await prisma.tutor.create({
      data: {
        name: 'E2E Tutor',
        timezone: 'Europe/London',
        hourlyCents: 4000,
        workingHours: [],
        email: tutorEmail,
        passwordHash: hashPassword('s3cret-pass'),
        emailVerified: true,
      },
    });
    tutorId = tutor.id;
    const student = await prisma.student.create({
      data: { fullName: 'E2E Student', email: studentEmail },
    });
    studentId = student.id;
    signupEmail = `e2e-signup+${stamp}@example.com`;
  });

  afterAll(async () => {
    if (tutorId !== '') await prisma.tutor.deleteMany({ where: { id: tutorId } });
    if (signupTutorId !== '') await prisma.tutor.deleteMany({ where: { id: signupTutorId } });
    if (studentId !== '') await prisma.student.deleteMany({ where: { id: studentId } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);

  const gql = (query: string, token?: string): request.Test => {
    const req = http().post('/graphql').send({ query });
    return token === undefined ? req : req.set('authorization', `Bearer ${token}`);
  };

  const tutorToken = async (): Promise<string> => {
    const res = await http().post('/auth/tutor/dev-login').send({ email: tutorEmail }).expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };
  const studentToken = async (): Promise<string> => {
    const res = await http().post('/auth/dev-login').send({ email: studentEmail }).expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };

  it('tutor dev-login returns a token and tutorId', async () => {
    const res = await http().post('/auth/tutor/dev-login').send({ email: tutorEmail }).expect(200);
    const body = res.body as { accessToken: string; tutorId: string };
    expect(body.accessToken).toBeTruthy();
    expect(body.tutorId).toBe(tutorId);
  });

  it('tutorSignup creates an inactive, unverified tutor and issues a code', async () => {
    // Signup deliberately mints no token: the tutor must verify their email
    // first. `devCode` is returned only because this run has no email transport.
    const res = await gql(
      `mutation { tutorSignup(fullName: "E2E Signup", email: "${signupEmail}", password: "s3cret-pass") { tutorId requiresVerification devCode } }`,
    ).expect(200);
    const data = res.body as {
      data: { tutorSignup: { tutorId: string; requiresVerification: boolean; devCode: string } };
    };
    signupTutorId = data.data.tutorSignup.tutorId;
    expect(signupTutorId).toBeTruthy();
    expect(data.data.tutorSignup.requiresVerification).toBe(true);
    expect(data.data.tutorSignup.devCode).toMatch(/^\d{6}$/);
    signupCode = data.data.tutorSignup.devCode;

    const created = await prisma.tutor.findUniqueOrThrow({ where: { id: signupTutorId } });
    expect(created.name).toBe('E2E Signup');
    expect(created.isActive).toBe(false);
    expect(created.emailVerified).toBe(false);
  });

  it('tutorVerifyEmail rejects a wrong code', async () => {
    const wrong = signupCode === '000000' ? '111111' : '000000';
    const res = await gql(
      `mutation { tutorVerifyEmail(email: "${signupEmail}", code: "${wrong}") { accessToken } }`,
    ).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toContain('invalid or has expired');
  });

  it('tutorVerifyEmail exchanges a valid code for a token', async () => {
    const res = await gql(
      `mutation { tutorVerifyEmail(email: "${signupEmail}", code: "${signupCode}") { tutorId accessToken } }`,
    ).expect(200);
    const data = res.body as {
      data: { tutorVerifyEmail: { tutorId: string; accessToken: string } };
    };
    expect(data.data.tutorVerifyEmail.tutorId).toBe(signupTutorId);
    expect(data.data.tutorVerifyEmail.accessToken).toBeTruthy();

    const verified = await prisma.tutor.findUniqueOrThrow({ where: { id: signupTutorId } });
    expect(verified.emailVerified).toBe(true);
    // The code is single-use: verifying clears any outstanding codes.
    const left = await prisma.tutorEmailVerification.count({ where: { tutorId: signupTutorId } });
    expect(left).toBe(0);
  });

  it('tutorSignup rejects a duplicate email', async () => {
    const res = await gql(
      `mutation { tutorSignup(fullName: "Dupe", email: "${signupEmail}", password: "s3cret-pass") { tutorId } }`,
    ).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toContain('already exists');
  });

  it('a signed-up tutor can then sign in with the same credentials', async () => {
    const res = await gql(
      `mutation { tutorSignin(email: "${signupEmail}", password: "s3cret-pass") { tutorId } }`,
    ).expect(200);
    const data = res.body as { data: { tutorSignin: { tutorId: string } } };
    expect(data.data.tutorSignin.tutorId).toBe(signupTutorId);
  });

  it('tutorSignin refuses an unverified tutor, even with the right password', async () => {
    // The whole point of verification: without this, signing up with someone
    // else's address and then signing in with your own password is enough.
    const stamp = `${Date.now()}-unverified`;
    const email = `e2e-unverified+${stamp}@example.com`;
    const created = await prisma.tutor.create({
      data: {
        name: 'Never Verified',
        timezone: 'Europe/London',
        hourlyCents: 4000,
        workingHours: [],
        email,
        passwordHash: hashPassword('s3cret-pass'),
        emailVerified: false,
      },
    });
    try {
      const res = await gql(
        `mutation { tutorSignin(email: "${email}", password: "s3cret-pass") { accessToken } }`,
      ).expect(200);
      const body = res.body as {
        data?: { tutorSignin: unknown };
        errors?: { message: string; extensions?: { code?: string } }[];
      };
      expect(body.data?.tutorSignin ?? null).toBeNull();
      expect(body.errors?.[0]?.extensions?.code).toBe('EMAIL_NOT_VERIFIED');
    } finally {
      await prisma.tutor.deleteMany({ where: { id: created.id } });
    }
  });

  it('tutorSignin verifies the password and returns a token', async () => {
    const res = await gql(
      `mutation { tutorSignin(email: "${tutorEmail}", password: "s3cret-pass") { tutorId accessToken } }`,
    ).expect(200);
    const data = res.body as { data: { tutorSignin: { tutorId: string; accessToken: string } } };
    expect(data.data.tutorSignin.tutorId).toBe(tutorId);
    expect(data.data.tutorSignin.accessToken).toBeTruthy();
  });

  it('tutorSignin rejects a wrong password', async () => {
    const res = await gql(
      `mutation { tutorSignin(email: "${tutorEmail}", password: "wrong") { tutorId } }`,
    ).expect(200);
    const body = res.body as { errors?: unknown[] };
    expect(body.errors).toBeDefined();
  });

  it('meTutor returns the signed-in tutor', async () => {
    const res = await gql('{ meTutor { id name } }', await tutorToken()).expect(200);
    const data = res.body as { data: { meTutor: { id: string; name: string } } };
    expect(data.data.meTutor.id).toBe(tutorId);
    expect(data.data.meTutor.name).toBe('E2E Tutor');
  });

  it('the tutor guard rejects a student token', async () => {
    const res = await gql('{ meTutor { id } }', await studentToken()).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toContain('tutor token');
  });

  it('the student guard rejects a tutor token', async () => {
    const res = await gql('{ me { id } }', await tutorToken()).expect(200);
    const body = res.body as { errors?: { message: string }[] };
    expect(body.errors?.[0]?.message).toContain('student token');
  });
});
