import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext, type GqlContextType } from '@nestjs/graphql';

/** The kind of principal a JWT represents. Absent on legacy tokens ⇒ student. */
export type PrincipalKind = 'student' | 'tutor';

/** Decoded JWT payload. `kind` is optional for backward compatibility. */
export interface JwtPayload {
  sub: string;
  kind?: PrincipalKind;
}

/** The authenticated student attached to a request by {@link JwtAuthGuard}. */
export interface AuthUser {
  studentId: string;
}

/** The authenticated tutor attached to a request by the tutor guard. */
export interface TutorPrincipal {
  tutorId: string;
}

export interface RequestWithUser {
  headers: { authorization?: string };
  user?: AuthUser;
  tutor?: TutorPrincipal;
}

/** Shape of the GraphQL execution context our guards/decorators rely on. */
export interface GqlAuthContext {
  req: RequestWithUser;
}

/**
 * The request behind an execution context, whichever transport it arrived on.
 *
 * `GqlExecutionContext.getContext()` only yields `{ req }` for GraphQL; on an
 * HTTP handler it returns the third handler argument instead, so a guard that
 * assumes GraphQL reads `undefined.req` and fails on any REST route.
 */
export function requestOf(context: ExecutionContext): RequestWithUser {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<GqlAuthContext>().req;
  }
  return context.switchToHttp().getRequest<RequestWithUser>();
}
