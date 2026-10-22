import type { EnvironmentProviders } from '@angular/core';

/**
 * Development-only providers — none in a production build.
 *
 * `ng serve` (the `development` configuration) swaps this file for
 * dev-tools.development.ts through angular.json `fileReplacements`, so the
 * Redux DevTools integration is never bundled into production. A runtime check
 * such as `logOnly: !isDevMode()` would still ship its ~15 kB to every visitor.
 */
export const devTools: EnvironmentProviders[] = [];
