import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { GqlAuthContext } from './auth-user.js';

const BEARER = 'Bearer ';

/** Verifies a Bearer JWT and attaches `{ studentId }` to the request. */
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
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(BEARER.length));
      ctx.req.user = { studentId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }
  }
}
