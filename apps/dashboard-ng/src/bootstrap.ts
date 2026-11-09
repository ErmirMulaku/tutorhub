import type { NativeFederationResult } from '@angular-architects/native-federation';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { FEDERATION } from './app/core/federation/federation';

/**
 * Starts the app (called by main.ts once Native Federation has started).
 * `federation` is null when it failed to start; remote routes then show
 * their fallback instead of loading.
 */
export function bootstrap(federation: NativeFederationResult | null): void {
  bootstrapApplication(App, {
    providers: [...appConfig.providers, { provide: FEDERATION, useValue: federation }],
  }).catch((err: unknown) => console.error(err));
}
