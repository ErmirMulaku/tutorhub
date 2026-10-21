import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';
import { AuthActions, TOKEN_KEY, TUTOR_KEY } from './auth.store';

/** Persist a new session (what the React slice did inside its reducer). */
export const persistCredentials = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AuthActions.setCredentials),
      tap(({ token, tutorId }) => {
        try {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(TUTOR_KEY, tutorId);
        } catch {
          /* storage unavailable — keep in-memory only */
        }
      }),
    ),
  { functional: true, dispatch: false },
);

/**
 * On sign-out — explicit, account deletion, or a 401 from the interceptor —
 * forget the stored session and go to /login. React got the redirect for free
 * by re-rendering `<Navigate>` in AppShell; Angular guards only run on
 * navigation, so the redirect is an explicit effect here.
 */
export const clearCredentials = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.clearCredentials),
      tap(() => {
        try {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TUTOR_KEY);
        } catch {
          /* ignore */
        }
        void router.navigateByUrl('/login', { replaceUrl: true });
      }),
    ),
  { functional: true, dispatch: false },
);
