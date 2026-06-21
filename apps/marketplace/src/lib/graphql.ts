import { GRAPHQL_URL } from './env';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface GraphQLRequestOptions {
  variables?: Record<string, unknown>;
  /** Forwarded to `fetch` — e.g. `{ revalidate: 60 }` or `'no-store'`. */
  next?: NextFetchRequestConfig;
  cache?: RequestCache;
  /** Bearer token for authenticated operations (e.g. booking). */
  token?: string;
}

/** A GraphQL operation that surfaced one or more `errors` in the response. */
export class GraphQLRequestError extends Error {
  constructor(public readonly errors: Array<{ message: string }>) {
    super(errors.map((e) => e.message).join('; '));
    this.name = 'GraphQLRequestError';
  }
}

/**
 * Minimal typed GraphQL client over `fetch` — no Apollo/urql runtime. Server
 * Components call this directly; caching is controlled per-call via `next`.
 */
export async function graphqlRequest<T>(
  query: string,
  options: GraphQLRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: options.variables ?? {} }),
    ...(options.cache ? { cache: options.cache } : {}),
    ...(options.next ? { next: options.next } : {}),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) throw new GraphQLRequestError(body.errors);
  if (body.data === undefined) throw new Error('GraphQL response contained no data');
  return body.data;
}
