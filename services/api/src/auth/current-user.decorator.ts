import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser, GqlAuthContext } from './auth-user.js';

/** Injects the authenticated {@link AuthUser} (set by {@link JwtAuthGuard}). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const ctx = GqlExecutionContext.create(context).getContext<GqlAuthContext>();
    if (ctx.req.user === undefined) {
      throw new UnauthorizedException();
    }
    return ctx.req.user;
  },
);
