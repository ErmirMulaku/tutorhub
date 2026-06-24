import { randomInt } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BadRequestDomainError, EntityNotFoundError } from '../common/errors.js';
import type { OAuthProvider } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';

export interface AuthResult {
  accessToken: string;
  studentId: string;
}

export interface SignupResult {
  studentId: string;
  requiresVerification: boolean;
  /** Surfaced in non-production only — there is no real email transport. */
  devCode: string | null;
}

/** 15-minute lifetime for an email verification code. */
const CODE_TTL_MS = 15 * 60 * 1000;
const isProd = (): boolean => process.env.NODE_ENV === 'production';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private signFor(studentId: string): Promise<string> {
    return this.jwt.signAsync({ sub: studentId });
  }

  /**
   * Issue a fresh 6-digit code for a student, replacing any outstanding ones.
   * Mock transport: the code is logged (and returned to the caller off-prod)
   * since there is no SMTP provider wired.
   */
  private async issueVerificationCode(studentId: string, email: string): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.emailVerification.deleteMany({ where: { studentId } });
    await this.prisma.emailVerification.create({
      data: { studentId, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    this.logger.log(`Email verification code for ${email}: ${code}`);
    return code;
  }

  /**
   * Register a new student and start email verification. No session token is
   * returned until {@link verifyEmail} succeeds.
   */
  async signup(fullName: string, email: string, password: string): Promise<SignupResult> {
    const existing = await this.prisma.student.findUnique({ where: { email } });
    if (existing !== null) {
      throw new BadRequestDomainError('An account with this email already exists.');
    }
    const student = await this.prisma.student.create({
      data: { fullName, email, passwordHash: hashPassword(password) },
    });
    const code = await this.issueVerificationCode(student.id, email);
    return { studentId: student.id, requiresVerification: true, devCode: isProd() ? null : code };
  }

  /** Validate a 6-digit code, mark the email verified, and return a session token. */
  async verifyEmail(email: string, code: string): Promise<AuthResult> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    if (student === null) {
      throw new EntityNotFoundError('Student', email);
    }
    const record = await this.prisma.emailVerification.findFirst({
      where: { studentId: student.id, code },
      orderBy: { createdAt: 'desc' },
    });
    if (record === null || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestDomainError('That code is invalid or has expired.');
    }
    await this.prisma.student.update({
      where: { id: student.id },
      data: { emailVerified: true },
    });
    await this.prisma.emailVerification.deleteMany({ where: { studentId: student.id } });
    return { accessToken: await this.signFor(student.id), studentId: student.id };
  }

  /** Re-issue a verification code for a pending signup. */
  async resendVerificationCode(email: string): Promise<{ devCode: string | null }> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    if (student === null) {
      throw new EntityNotFoundError('Student', email);
    }
    const code = await this.issueVerificationCode(student.id, email);
    return { devCode: isProd() ? null : code };
  }

  /**
   * Sign in (or sign up) through a social provider. The provider handshake is
   * simulated by the client — no external Google/Apple secret is wired — but the
   * account upsert and session minting are real.
   */
  async oauthSignin(
    provider: OAuthProvider,
    providerUserId: string,
    email: string,
    fullName: string,
  ): Promise<AuthResult> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
    if (account !== null) {
      return { accessToken: await this.signFor(account.studentId), studentId: account.studentId };
    }
    // Link to an existing student by email, otherwise create a verified one.
    const student =
      (await this.prisma.student.findUnique({ where: { email } })) ??
      (await this.prisma.student.create({ data: { fullName, email, emailVerified: true } }));
    await this.prisma.oAuthAccount.create({
      data: { provider, providerUserId, studentId: student.id },
    });
    return { accessToken: await this.signFor(student.id), studentId: student.id };
  }

  /** Verify email + password and return a session token. */
  async signin(email: string, password: string): Promise<AuthResult> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    if (student === null || student.passwordHash === null) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!verifyPassword(password, student.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return { accessToken: await this.signFor(student.id), studentId: student.id };
  }

  /**
   * Dev-only login: mints a JWT for an existing student by email. Real password
   * auth is out of scope (mocked) — the token is the same one every transport
   * verifies.
   */
  async devLogin(email: string): Promise<{ accessToken: string }> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    if (student === null) {
      throw new EntityNotFoundError('Student', email);
    }
    const accessToken = await this.jwt.signAsync({ sub: student.id });
    return { accessToken };
  }
}
