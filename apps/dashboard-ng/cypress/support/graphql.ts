/**
 * Helpers for the fake API, shared by the support file and the specs. No side
 * effects here: Cypress bundles the support file and each spec separately, so
 * this module may be loaded twice — which is also why a whole-body override is
 * marked with a plain flag rather than a class (`instanceof` would fail across
 * the two copies).
 */

/** A fixture value, or a function of the request's variables and the default value. */
export type Resolver = unknown;

export interface GraphqlBody {
  readonly isGraphqlBody: true;
  readonly body: { data?: unknown; errors?: { message: string; extensions?: object }[] };
}

export function isGraphqlBody(value: unknown): value is GraphqlBody {
  return typeof value === 'object' && value !== null && 'isGraphqlBody' in value;
}

/** Reply with GraphQL `errors` (HTTP 200, like the real API) instead of `data`. */
export function graphqlError(message: string, code?: string): GraphqlBody {
  return {
    isGraphqlBody: true,
    body: { errors: [{ message, ...(code !== undefined && { extensions: { code } }) }] },
  };
}

/** The first field after the opening brace: `query($id: ID!){ messages(…) }` → `messages`. */
export function rootField(query: string): string {
  return /^\s*(?:query|mutation)?\s*(?:\([^)]*\))?\s*\{\s*(\w+)/.exec(query)?.[1] ?? 'unknown';
}
