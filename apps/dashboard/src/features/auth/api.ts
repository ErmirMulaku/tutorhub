import { API_URL } from '../../env';

/** Minimal GraphQL POST — the auth screens run before the store's API client. */
export async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as T;
}

export interface GraphqlError {
  message: string;
  extensions?: { code?: string };
}

/**
 * True when sign-in failed only because the address is unverified.
 *
 * The API raises this as its own `EMAIL_NOT_VERIFIED` code rather than a
 * generic bad-input error, so callers can offer a new code instead of a dead
 * end. Matched on the code, not the message, so copy edits cannot break it.
 */
export function isEmailNotVerified(errors: GraphqlError[] | undefined): boolean {
  return errors?.some((e) => e.extensions?.code === 'EMAIL_NOT_VERIFIED') ?? false;
}
