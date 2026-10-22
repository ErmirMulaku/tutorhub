import { HttpContextToken, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthActions, authFeature } from './auth.store';

/**
 * Set on requests that must go out without a token — the sign-in / sign-up /
 * verify calls, which the React app sends through a separate raw `fetch`.
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/**
 * Port of the RTK Query base query's two auth duties:
 * - `prepareHeaders`: add `Authorization: Bearer <token>` to API calls;
 * - a 401 response clears the session (→ the auth effect redirects to /login).
 *
 * The token is only attached to our own API, never to another origin.
 * GraphQL auth errors arrive as HTTP 200, so those are handled in GraphqlClient.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH) || !req.url.startsWith(environment.apiUrl)) return next(req);

  const store = inject(Store);
  const token = store.selectSignal(authFeature.selectToken)();
  const authed =
    token === null ? req : req.clone({ setHeaders: { authorization: `Bearer ${token}` } });

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        store.dispatch(AuthActions.clearCredentials());
      }
      return throwError(() => err);
    }),
  );
};
