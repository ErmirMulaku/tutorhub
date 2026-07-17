import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { type AuthUser, requestOf } from './auth-user.js';

/** Injects the authenticated {@link AuthUser} (set by {@link JwtAuthGuard}). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = requestOf(context).user;
    if (user === undefined) {
      throw new UnauthorizedException();
    }
    return user;
  },
);
