import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** Default sender for transactional email — Resend's shared test domain, which
 * requires no DNS/domain verification and works immediately in every account. */
const DEFAULT_FROM = 'TutorHub <onboarding@resend.dev>';

/**
 * Thin wrapper around Resend, configured from `RESEND_API_KEY`.
 *
 * When no key is configured the client is left `null` and {@link enabled} is
 * false: callers fall back to logging the code instead of crashing, so local
 * dev and CI keep working without a Resend account.
 *
 * In production that fallback is refused. Without a transport, a code can only
 * reach the user by being logged or returned to the caller — the first makes
 * signup unusable, the second hands out the code to whoever asked for it. Both
 * are worse than not booting, so a missing key fails the deploy instead: App
 * Runner's health check fails and the rollout is rolled back.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('EMAIL_FROM') ?? DEFAULT_FROM;
    if (key === undefined || key === '') {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new Error(
          'RESEND_API_KEY is required in production: without it, email verification ' +
            'cannot deliver codes and would have to be bypassed to work.',
        );
      }
      this.client = null;
      this.logger.warn('RESEND_API_KEY not set — verification codes are logged, not emailed.');
    } else {
      this.client = new Resend(key);
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Send a 6-digit verification code. No-ops (logs only) when Resend isn't configured. */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    if (this.client === null) {
      this.logger.log(`Verification code for ${to}: ${code}`);
      return;
    }
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: `${code} is your TutorHub verification code`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0e8f8a;">Verify your email</h2>
          <p>Enter this code to finish setting up your TutorHub account:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${code}</p>
          <p style="color: #5b6b7b; font-size: 13px;">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
        </div>
      `,
    });
    if (error) {
      // Don't fail the signup flow on a transport error — the code still
      // exists in the DB and can be re-sent, and this is logged for follow-up.
      this.logger.error(`Failed to send verification email to ${to}: ${error.message}`);
    }
  }
}
