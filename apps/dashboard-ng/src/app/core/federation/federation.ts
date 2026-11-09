import { Injectable, InjectionToken, type Type, inject } from '@angular/core';
import type { Route, Routes } from '@angular/router';
import type { NativeFederationResult } from '@angular-architects/native-federation';
import { MANIFEST_URL } from './manifest-url';

/**
 * The result of `initFederation()` in main.ts, or `null` when Native Federation
 * could not start at all; remote routes then show their fallback.
 * (A missing manifest isn't that case: main.ts then starts with no remotes.)
 *
 * Injected rather than imported: the package's top-level `loadRemoteModule` is
 * deprecated in Native Federation v4 (it relies on module-scoped state) and is
 * typed `any`; this instance's `loadRemoteModule<T>` is typed `unknown`.
 */
export const FEDERATION = new InjectionToken<NativeFederationResult | null>('FEDERATION');

/** Thrown when a remote can't be loaded (down, 404, CORS, network, not in the manifest). */
export class RemoteUnavailableError extends Error {
  constructor(
    readonly remote: string,
    override readonly cause: unknown,
  ) {
    super(`Remote '${remote}' is unavailable.`);
    this.name = 'RemoteUnavailableError';
  }
}

/**
 * Loads exposed modules from remotes, remembering only successes: a failed
 * load is attempted again next time, which is what makes "Retry" work.
 */
@Injectable({ providedIn: 'root' })
export class RemoteModules {
  private readonly federation = inject(FEDERATION);
  private readonly loaded = new Map<string, Promise<unknown>>();

  load<T>(remote: string, exposed: string): Promise<T> {
    const key = `${remote}/${exposed}`;
    let module = this.loaded.get(key);
    if (module === undefined) {
      module = this.attempt(remote, exposed).catch((cause: unknown) => {
        this.loaded.delete(key);
        // One line per failed attempt; the cause carries the details.
        console.error(`[federation] Could not load '${exposed}' from '${remote}':`, cause);
        throw new RemoteUnavailableError(remote, cause);
      });
      this.loaded.set(key, module);
    }
    return module as Promise<T>;
  }

  private async attempt(remote: string, exposed: string): Promise<unknown> {
    const federation = this.federation;
    if (federation === null) throw new Error('Native Federation did not start.');
    try {
      return await federation.loadRemoteModule(remote, exposed);
    } catch (first: unknown) {
      // A remote that was down when the app started was skipped, so the
      // runtime no longer knows it. Look its URL up again and register it
      // before the second (and last) try.
      const url = await remoteEntryUrl(remote);
      if (url === undefined) throw first;
      await federation.initRemoteEntry(url, remote);
      return federation.loadRemoteModule(remote, exposed);
    }
  }
}

async function remoteEntryUrl(remote: string): Promise<string | undefined> {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${MANIFEST_URL}: HTTP ${String(response.status)}`);
  const manifest = (await response.json()) as Partial<Record<string, string>>;
  return manifest[remote];
}

export interface RemoteRoutesOptions<K extends string> {
  /** The shell's route path, e.g. `reviews`. */
  path: string;
  /** The remote's name in federation.manifest.json. */
  remote: string;
  /** The exposed key from the remote's federation.config.mjs. */
  exposed: string;
  /** The `Routes` export of that module. */
  exportName: K;
  /** Shown while the remote is unavailable, inside the normal layout. */
  fallback: Type<unknown>;
  /** Passed to the fallback as route data (bound to its inputs). */
  data?: Route['data'];
}

/**
 * Two routes on the same path: the remote's routes, matched only once the
 * remote has loaded (`canMatch`), and the fallback, matched when it hasn't.
 *
 * `canMatch` runs on every navigation and failed loads aren't cached, so
 * navigating to the path again is a retry. The URL, the page title and the
 * active sidebar link stay the same whichever route renders.
 */
export function remoteRoutes<K extends string>(options: RemoteRoutesOptions<K>): Routes {
  const { path, remote, exposed, exportName } = options;
  const load = (): Promise<Record<K, Routes>> =>
    inject(RemoteModules).load<Record<K, Routes>>(remote, exposed);
  return [
    {
      path,
      canMatch: [
        () =>
          load().then(
            () => true,
            () => false,
          ),
      ],
      loadChildren: () => load().then((module) => module[exportName]),
    },
    { path, component: options.fallback, data: options.data ?? {} },
  ];
}
