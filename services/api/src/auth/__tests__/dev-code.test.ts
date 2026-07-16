import { describe, expect, it } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { EmailService } from '../../email/email.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../auth.service.js';

/**
 * `devCode` returns a verification code to the API caller so local dev can
 * verify an account without an email transport. Returning it in production
 * would let anyone verify an address they do not control, so these pin the
 * one rule that matters: never in production, whatever else is configured.
 */

interface Harness {
  service: AuthService;
  sent: { to: string; code: string }[];
}

function harness(opts: { nodeEnv: string; emailEnabled: boolean }): Harness {
  const sent: { to: string; code: string }[] = [];

  const prisma = {
    tutor: {
      findUnique: () => Promise.resolve(null),
      create: () => Promise.resolve({ id: 'tutor-1' }),
    },
    student: {
      findUnique: () => Promise.resolve(null),
      create: () => Promise.resolve({ id: 'student-1' }),
    },
    tutorEmailVerification: {
      deleteMany: () => Promise.resolve({}),
      create: () => Promise.resolve({}),
    },
    emailVerification: {
      deleteMany: () => Promise.resolve({}),
      create: () => Promise.resolve({}),
    },
  } as unknown as PrismaService;

  const jwt = { signAsync: () => Promise.resolve('token') } as unknown as JwtService;
  const config = {
    get: (key: string) => (key === 'NODE_ENV' ? opts.nodeEnv : undefined),
  } as unknown as ConfigService;
  const email = {
    enabled: opts.emailEnabled,
    sendVerificationCode: (to: string, code: string) => {
      sent.push({ to, code });
      return Promise.resolve();
    },
  } as unknown as EmailService;

  return { service: new AuthService(prisma, jwt, config, email), sent };
}

describe('devCode is never returned in production', () => {
  it('withholds the code on tutor signup in production, even with no transport', async () => {
    // The dangerous combination: production, and RESEND_API_KEY missing.
    const { service } = harness({ nodeEnv: 'production', emailEnabled: false });
    const result = await service.tutorSignup('Ada', 'ada@example.com', 'password123');
    expect(result.devCode).toBeNull();
  });

  it('withholds the code on student signup in production', async () => {
    const { service } = harness({ nodeEnv: 'production', emailEnabled: false });
    const result = await service.signup('Ada', 'ada@example.com', 'password123');
    expect(result.devCode).toBeNull();
  });

  it('returns the emailed code off-production when there is no transport', async () => {
    const { service, sent } = harness({ nodeEnv: 'development', emailEnabled: false });
    const result = await service.tutorSignup('Ada', 'ada@example.com', 'password123');
    expect(result.devCode).toMatch(/^\d{6}$/);
    // It must be the same code that was issued, or local dev cannot verify.
    expect(result.devCode).toBe(sent[0]?.code);
  });

  it('withholds the code off-production once a transport exists', async () => {
    const { service } = harness({ nodeEnv: 'development', emailEnabled: true });
    const result = await service.tutorSignup('Ada', 'ada@example.com', 'password123');
    expect(result.devCode).toBeNull();
  });
});
