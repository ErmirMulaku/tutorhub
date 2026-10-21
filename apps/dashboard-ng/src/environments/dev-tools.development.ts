import type { EnvironmentProviders } from '@angular/core';
import { provideStoreDevtools } from '@ngrx/store-devtools';

/** Replaces dev-tools.ts in development builds: the Redux DevTools browser extension. */
export const devTools: EnvironmentProviders[] = [provideStoreDevtools({ maxAge: 25 })];
