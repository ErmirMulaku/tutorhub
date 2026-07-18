import { afterEach, describe, expect, it } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { AuthController } from '../auth.controller.js';
import type { AuthService } from '../auth.service.js';
import type { DevLoginDto } from '../dto/dev-login.dto.js';

/**
 * Dev-login mints a session for any known email with no password. It must be
 * unreachable in production — these tests pin that gate, since a regression is a
 * silent account-takeover hole.
 */
describe('AuthController dev-login production gate', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const auth = {
    devLogin: () => Promise.resolve({ accessToken: 'student-token' }),
    tutorDevLogin: () => Promise.resolve({ accessToken: 'tutor-token', tutorId: 't1' }),
  } as unknown as AuthService;
  const controller = new AuthController(auth);
  const dto: DevLoginDto = { email: 'sara@example.com' };

  it('hides both dev-login routes as 404 in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => controller.devLogin(dto)).toThrow(NotFoundException);
    expect(() => controller.tutorDevLogin(dto)).toThrow(NotFoundException);
  });

  it('serves them outside production', async () => {
    process.env.NODE_ENV = 'test';
    await expect(controller.devLogin(dto)).resolves.toEqual({ accessToken: 'student-token' });
    await expect(controller.tutorDevLogin(dto)).resolves.toEqual({
      accessToken: 'tutor-token',
      tutorId: 't1',
    });
  });
});
