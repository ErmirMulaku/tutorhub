import { InjectionToken } from '@angular/core';

/**
 * The API origin, e.g. `http://localhost:4000` (no trailing slash).
 *
 * A token rather than the app's build-time `API_URL` constant: the kit is
 * shared at runtime between the dashboard and its remotes as one pre-built
 * bundle, so it can't depend on one app's `define`. Each app provides it —
 * the dashboard from its own `API_URL`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
