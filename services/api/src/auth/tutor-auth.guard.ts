import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { GqlAuthContext, JwtPayload } from './auth-user.js';

const BEARER = 'Bearer ';

/**
 * Verifies a Bearer JWT and attaches `{ tutorId }` to `req.tutor` (never
 * `req.user`). Strict: only tokens minted with `kind: 'tutor'` are accepted, so
 * a student token can never reach a tutor-scoped resolver.
 */
@Injectable()
export class TutorAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context).getContext<GqlAuthContext>();
    const header = ctx.req.headers.authorization;
    if (header === undefined || !header.startsWith(BEARER)) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(BEARER.length));
      if (payload.kind !== 'tutor') {
        throw new UnauthorizedException('This endpoint requires a tutor token.');
      }
      ctx.req.tutor = { tutorId: payload.sub };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid token.');
    }
  }
}
