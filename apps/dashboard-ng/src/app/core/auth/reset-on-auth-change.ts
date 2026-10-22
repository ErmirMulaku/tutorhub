import type { ActionReducer } from '@ngrx/store';
import { AuthActions } from './auth.store';

/** Store slices that belong to the session itself and survive an account switch. */
const KEEP = ['auth', 'ui'] as const;

/**
 * Port of the listener in apps/dashboard/src/store/store.ts: wipe every cached
 * response whenever the signed-in tutor changes, so a sign-out followed by a
 * sign-in never shows the previous tutor's name, bookings or KPIs.
 *
 * A meta-reducer wraps the root reducer and sees every action first. Here it
 * drops all data slices before the real reducers run, so each feature reducer
 * falls back to its initial state. (Component-scoped `cachedQuery`s need no
 * reset — they're destroyed with the shell on sign-out.)
 */
export function resetOnAuthChange<S extends Record<string, unknown>>(
  reducer: ActionReducer<S>,
): ActionReducer<S> {
  return (state, action) => {
    if (
      state !== undefined &&
      (action.type === AuthActions.setCredentials.type ||
        action.type === AuthActions.clearCredentials.type)
    ) {
      const kept = Object.fromEntries(
        KEEP.filter((key) => key in state).map((key) => [key, state[key]]),
      ) as S;
      return reducer(kept, action);
    }
    return reducer(state, action);
  };
}
