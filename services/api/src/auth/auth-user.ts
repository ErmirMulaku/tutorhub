/** The authenticated principal attached to a request by {@link JwtAuthGuard}. */
export interface AuthUser {
  studentId: string;
}

interface RequestWithUser {
  headers: { authorization?: string };
  user?: AuthUser;
}

/** Shape of the GraphQL execution context our guard/decorator rely on. */
export interface GqlAuthContext {
  req: RequestWithUser;
}
