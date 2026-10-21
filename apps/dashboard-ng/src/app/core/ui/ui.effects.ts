import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { tap, withLatestFrom } from 'rxjs';
import { ACCENT_KEY, THEME_KEY, UiActions, uiFeature } from './ui.store';

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * Persist the theme after either action that changes it. `toggleTheme` carries
 * no payload, so the new value is read back from the store — effects run after
 * the reducer, so the store already holds it.
 */
export const persistTheme = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(UiActions.setTheme, UiActions.toggleTheme),
      withLatestFrom(store.select(uiFeature.selectTheme)),
      tap(([, theme]) => save(THEME_KEY, theme)),
    ),
  { functional: true, dispatch: false },
);

export const persistAccent = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(UiActions.setAccent),
      tap(({ accent }) => save(ACCENT_KEY, accent)),
    ),
  { functional: true, dispatch: false },
);
