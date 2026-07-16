import { describe, expect, it } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service.js';

/** Minimal ConfigService stand-in — EmailService only reads string keys. */
function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('EmailService transport gating', () => {
  it('refuses to boot in production without RESEND_API_KEY', () => {
    // Fails the deploy rather than running with no way to deliver a code.
    expect(() => new EmailService(configWith({ NODE_ENV: 'production' }))).toThrow(
      /RESEND_API_KEY is required in production/,
    );
  });

  it('boots in production when RESEND_API_KEY is set', () => {
    const service = new EmailService(
      configWith({ NODE_ENV: 'production', RESEND_API_KEY: 're_test_key' }),
    );
    expect(service.enabled).toBe(true);
  });

  it('boots without a key off-production, with the transport disabled', () => {
    const service = new EmailService(configWith({ NODE_ENV: 'development' }));
    expect(service.enabled).toBe(false);
  });

  it('treats an empty key as unset', () => {
    expect(
      () => new EmailService(configWith({ NODE_ENV: 'production', RESEND_API_KEY: '' })),
    ).toThrow(/RESEND_API_KEY is required in production/);
  });
});
