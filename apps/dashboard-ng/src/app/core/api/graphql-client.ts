import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { type Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthActions } from '../auth/auth.store';

export interface GraphqlErrorEntry {
  message: string;
  extensions?: { code?: string };
}

/** The raw GraphQL-over-HTTP body: `data`, `errors`, or both. */
export interface GraphqlBody<T> {
  data?: T;
  errors?: GraphqlErrorEntry[];
}

/** A response that came back with `errors` (or no `data`). */
export class GraphqlError extends Error {
  constructor(
    message: string,
    readonly errors: GraphqlErrorEntry[],
  ) {
    super(message);
    this.name = 'GraphqlError';
  }
}

/**
 * GraphQL as a plain POST to `/graphql` — no Apollo. Port of the GraphQL half
 * of the React base query: unwrap `data`, turn `errors` into an error, and
 * clear the session when the message looks like an auth failure (same regex),
 * because those come back as HTTP 200 and never reach the interceptor's 401
 * branch.
 */
@Injectable({ providedIn: 'root' })
export class GraphqlClient {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  request<T>(document: string, variables: Record<string, unknown> = {}): Observable<T> {
    return this.http
      .post<GraphqlBody<T>>(`${environment.apiUrl}/graphql`, { query: document, variables })
      .pipe(
        map((body) => {
          if (body.errors && body.errors.length > 0) {
            const message = body.errors[0]?.message ?? 'GraphQL error';
            if (/token|unauth/i.test(message)) this.store.dispatch(AuthActions.clearCredentials());
            throw new GraphqlError(message, body.errors);
          }
          if (body.data === undefined) throw new GraphqlError('Empty GraphQL response', []);
          return body.data;
        }),
      );
  }
}
