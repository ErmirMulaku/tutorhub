import { randomInt } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { BadRequestDomainError, EntityNotFoundError } from '../common/errors.js';
import { OAuthProvider } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';

export interface AuthResult {
  accessToken: string;
  studentId: string;
}

export interface TutorAuthResult {
  accessToken: string;
  tutorId: string;
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

// Provider JWKS endpoints (jose caches the fetched keys internally).
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Mint a JWT for a principal. `kind` discriminates students from tutors. */
  private sign(sub: string, kind: 'student' | 'tutor'): Promise<string> {
    return this.jwt.signAsync({ sub, kind });
  }

  private signFor(studentId: string): Promise<string> {
    return this.sign(studentId, 'student');
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

  /**
   * Verify a provider-issued OpenID Connect ID token against the provider's
   * published JWKS, enforcing audience (our client id) and issuer.
   */
  private async verifyIdToken(
    idToken: string,
    jwks: ReturnType<typeof createRemoteJWKSet>,
    audience: string,
    issuer: string | string[],
  ): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(idToken, jwks, { audience, issuer });
      return payload;
    } catch {
      throw new UnauthorizedException('Could not verify the social sign-in token.');
    }
  }

  /** Real Google sign-in: verify the GIS ID token, then upsert the account. */
  async googleSignin(idToken: string): Promise<AuthResult> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (clientId === undefined || clientId === '') {
      throw new BadRequestDomainError('Google sign-in is not configured.');
    }
    const payload = await this.verifyIdToken(idToken, GOOGLE_JWKS, clientId, GOOGLE_ISSUERS);
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (payload.sub === undefined || email === null) {
      throw new UnauthorizedException('Google token is missing required claims.');
    }
    const name = typeof payload.name === 'string' ? payload.name : email;
    return this.oauthSignin(OAuthProvider.GOOGLE, payload.sub, email, name);
  }

  /** Real Apple sign-in: verify the Sign in with Apple id_token, then upsert. */
  async appleSignin(idToken: string): Promise<AuthResult> {
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    if (clientId === undefined || clientId === '') {
      throw new BadRequestDomainError('Apple sign-in is not configured.');
    }
    const payload = await this.verifyIdToken(idToken, APPLE_JWKS, clientId, APPLE_ISSUER);
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (payload.sub === undefined || email === null) {
      throw new UnauthorizedException('Apple token is missing required claims.');
    }
    // Apple only returns the display name on the first authorization (and not in
    // the token), so derive a sensible fallback from the email local-part.
    const name = email.split('@')[0] ?? email;
    return this.oauthSignin(OAuthProvider.APPLE, payload.sub, email, name);
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

  /**
   * Register a new tutor with email + password and return a session token right
   * away. The account starts inactive (`isActive: false`) with placeholder
   * scheduling defaults — the dashboard onboarding wizard fills in the profile,
   * subjects, hours and payout, then publishes it.
   */
  async tutorSignup(fullName: string, email: string, password: string): Promise<TutorAuthResult> {
    const existing = await this.prisma.tutor.findUnique({ where: { email } });
    if (existing !== null) {
      throw new BadRequestDomainError('An account with this email already exists.');
    }
    const tutor = await this.prisma.tutor.create({
      data: {
        name: fullName,
        email,
        passwordHash: hashPassword(password),
        timezone: 'UTC',
        hourlyCents: 0,
        workingHours: [],
        isActive: false,
      },
    });
    return { accessToken: await this.sign(tutor.id, 'tutor'), tutorId: tutor.id };
  }

  /** Verify a tutor's email + password and return a tutor session token. */
  async tutorSignin(email: string, password: string): Promise<TutorAuthResult> {
    const tutor = await this.prisma.tutor.findUnique({ where: { email } });
    if (tutor === null || tutor.passwordHash === null) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!verifyPassword(password, tutor.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return { accessToken: await this.sign(tutor.id, 'tutor'), tutorId: tutor.id };
  }

  /** Dev-only login: mints a tutor JWT for an existing tutor by email. */
  async tutorDevLogin(email: string): Promise<TutorAuthResult> {
    const tutor = await this.prisma.tutor.findUnique({ where: { email } });
    if (tutor === null) {
      throw new EntityNotFoundError('Tutor', email);
    }
    return { accessToken: await this.sign(tutor.id, 'tutor'), tutorId: tutor.id };
  }
}
