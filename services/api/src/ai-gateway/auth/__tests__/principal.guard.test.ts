import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from '@jest/globals';
import { PrincipalGuard } from '../principal.guard.js';
import type { RequestWithPrincipal } from '../principal.js';

function makeContext(req: RequestWithPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeJwt(verifyAsync: (token: string) => Promise<unknown>): JwtService {
  return { verifyAsync } as unknown as JwtService;
}

describe('PrincipalGuard', () => {
  it('rejects a request with no bearer token (401)', async () => {
    const guard = new PrincipalGuard(makeJwt(() => Promise.resolve({})));
    const req: RequestWithPrincipal = { headers: {} };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token (401)', async () => {
    const guard = new PrincipalGuard(makeJwt(() => Promise.reject(new Error('bad signature'))));
    const req: RequestWithPrincipal = { headers: { authorization: 'Bearer bad' } };

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
  });

  it('attaches a tutor principal for a tutor token', async () => {
    const guard = new PrincipalGuard(makeJwt(() => Promise.resolve({ sub: 't1', kind: 'tutor' })));
    const req: RequestWithPrincipal = { headers: { authorization: 'Bearer tutor-token' } };

    await guard.canActivate(makeContext(req));

    expect(req.principal).toEqual({ id: 't1', kind: 'tutor' });
  });

  it('attaches a student principal when `kind` is absent (legacy token)', async () => {
    const guard = new PrincipalGuard(makeJwt(() => Promise.resolve({ sub: 's1' })));
    const req: RequestWithPrincipal = { headers: { authorization: 'Bearer student-token' } };

    await guard.canActivate(makeContext(req));

    expect(req.principal).toEqual({ id: 's1', kind: 'student' });
  });
});
