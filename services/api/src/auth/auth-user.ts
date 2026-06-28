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

interface RequestWithUser {
  headers: { authorization?: string };
  user?: AuthUser;
  tutor?: TutorPrincipal;
}

/** Shape of the GraphQL execution context our guards/decorators rely on. */
export interface GqlAuthContext {
  req: RequestWithUser;
}
