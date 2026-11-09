import { InjectionToken, inject } from '@angular/core';
import type { Routes } from '@angular/router';
import type { NativeFederationResult } from '@angular-architects/native-federation';

/**
 * The result of `initFederation()` in main.ts, or `null` when it failed (the
 * manifest couldn't be fetched, say) and the app started without remotes.
 *
 * Injected rather than imported: the package's top-level `loadRemoteModule` is
 * deprecated in Native Federation v4 (it relies on module-scoped state) and is
 * typed `any`; this instance's `loadRemoteModule<T>` is typed `unknown`.
 */
export const FEDERATION = new InjectionToken<NativeFederationResult | null>('FEDERATION');

/** The routes a remote exposes, e.g. `REVIEWS_ROUTES` from the Reviews remote's './routes'. */
export type RemoteRoutesModule<K extends string> = Record<K, Routes>;

/**
 * For a route's `loadChildren`: loads `exposed` from `remote` and returns the
 * `Routes` it exports under `exportName`. Must run in an injection context —
 * the router calls `loadChildren` inside one.
 */
export function loadRemoteRoutes<K extends string>(
  remote: string,
  exposed: string,
  exportName: K,
): Promise<Routes> {
  const federation = inject(FEDERATION);
  if (federation === null) {
    return Promise.reject(new Error('Native Federation did not start, so no remote can load.'));
  }
  return federation
    .loadRemoteModule<RemoteRoutesModule<K>>(remote, exposed)
    .then((module) => module[exportName]);
}
