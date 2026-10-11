import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../auth/auth-user.js';
import type { RequestWithPrincipal } from './principal.js';

const BEARER = 'Bearer ';

/**
 * Verifies a Bearer JWT and attaches `{ id, kind }` to `req.principal`.
 * Unlike `JwtAuthGuard` (student-only) and `TutorAuthGuard` (tutor-only,
 * GraphQL-only), this accepts either kind on REST — the gateway's per-task
 * `allowedKinds` check decides who may actually call a given task.
 */
@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith(BEARER)) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(BEARER.length));
      req.principal = { id: payload.sub, kind: payload.kind ?? 'student' };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }
  }
}
