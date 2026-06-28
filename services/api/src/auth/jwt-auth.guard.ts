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
 * Verifies a Bearer JWT and attaches `{ studentId }` to the request. Permissive
 * on `kind`: tokens with no `kind` claim (legacy student/marketplace/mobile
 * tokens) are accepted; an explicit `kind: 'tutor'` is rejected so a tutor token
 * can never act as a student.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context).getContext<GqlAuthContext>();
    const header = ctx.req.headers.authorization;
    if (header === undefined || !header.startsWith(BEARER)) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(BEARER.length));
      if (payload.kind === 'tutor') {
        throw new UnauthorizedException('This endpoint requires a student token.');
      }
      ctx.req.user = { studentId: payload.sub };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid token.');
    }
  }
}
