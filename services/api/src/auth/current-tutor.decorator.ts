import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { GqlAuthContext, TutorPrincipal } from './auth-user.js';

/** Injects the authenticated {@link TutorPrincipal} (set by `TutorAuthGuard`). */
export const CurrentTutor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TutorPrincipal => {
    const ctx = GqlExecutionContext.create(context).getContext<GqlAuthContext>();
    if (ctx.req.tutor === undefined) {
      throw new UnauthorizedException();
    }
    return ctx.req.tutor;
  },
);
