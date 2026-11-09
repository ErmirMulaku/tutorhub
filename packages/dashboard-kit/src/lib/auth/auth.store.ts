import {
  createActionGroup,
  createFeature,
  createReducer,
  createSelector,
  emptyProps,
  on,
  props,
} from '@ngrx/store';

/** Same storage keys as the React app, so a session survives switching apps. */
export const TOKEN_KEY = 'th_tutor_token';
export const TUTOR_KEY = 'th_tutor_id';

export interface AuthState {
  token: string | null;
  tutorId: string | null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The persisted session (or none), read once when the store is created. */
export function initialAuthState(): AuthState {
  return { token: read(TOKEN_KEY), tutorId: read(TUTOR_KEY) };
}

/**
 * Port of `auth-slice.ts`. Actions are plain events; the reducer only computes
 * the next state. Writing to localStorage is a side effect, so it lives in
 * `auth.effects.ts` instead of here (RTK allowed it in the reducer; NgRx
 * reducers stay pure).
 */
export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Set Credentials': props<{ token: string; tutorId: string }>(),
    'Clear Credentials': emptyProps(),
  },
});

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialAuthState(),
    on(AuthActions.setCredentials, (_state, { token, tutorId }): AuthState => ({ token, tutorId })),
    on(AuthActions.clearCredentials, (): AuthState => ({ token: null, tutorId: null })),
  ),
  // createFeature generates selectAuthState, selectToken and selectTutorId.
  extraSelectors: ({ selectToken }) => ({
    selectIsSignedIn: createSelector(selectToken, (token) => token !== null),
  }),
});
