import {
  fromPackageJson,
  mappingsFromWorkspace,
  withNativeFederation,
} from '@angular-architects/native-federation/config';

/**
 * Native Federation for the dashboard shell (a dynamic host: the remotes it
 * loads are listed in public/federation.manifest.json, read at startup).
 *
 * Everything shared here is loaded once and reused by every remote. Shared
 * packages are strict singletons: a remote built against another Angular,
 * NgRx or RxJS version fails to load (and the shell shows its fallback)
 * instead of running a second copy beside ours.
 */
export default withNativeFederation({
  name: 'dashboard-ng',

  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
    build: 'package',
  })
    .skip([
      // Shared as TypeScript source through its tsconfig path (sharedMappings
      // below), not as an npm package.
      '@ermulaku/dashboard-kit',
      // A handful of constant enums; each app bundles its own copy.
      '@ermulaku/types',
      // Only the shell opens the Socket.IO connection, so it stays an
      // ordinary (lazy) dependency of the shell instead of a shared bundle.
      'socket.io-client',
      // Development builds only (environments/dev-tools.development.ts).
      '@ngrx/store-devtools',
    ])
    .patch(['@angular/*'], { includeSecondaries: { keepAll: true } })
    .get(),

  // The kit is one singleton across shell and remotes: one ToastService, one
  // CacheTags, one auth store. Only its barrel is shared, so code must import
  // `@ermulaku/dashboard-kit`, never a deep path.
  sharedMappings: mappingsFromWorkspace({ singleton: true })
    .filter(['@ermulaku/dashboard-kit'])
    .get(),

  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],

  // https://native-federation.com/docs/v4/angular-adapter/configuration/
  features: {
    denseChunking: true,
    denseExternals: true,
    strictImports: false,
  },
});
