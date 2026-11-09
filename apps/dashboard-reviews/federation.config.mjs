import {
  fromPackageJson,
  mappingsFromWorkspace,
  withNativeFederation,
} from '@angular-architects/native-federation/config';

/**
 * The Reviews remote. The dashboard (apps/dashboard-ng) lists it in its
 * federation.manifest.json under the name `reviews` and mounts `./routes`
 * at /reviews.
 *
 * Sharing must match the shell's federation.config.mjs: the same strict-version
 * singletons (so the page runs on the shell's Angular, NgRx store and kit), and
 * the kit as a shared mapping rather than an npm package.
 */
export default withNativeFederation({
  name: 'reviews',

  exposes: {
    './routes': './src/app/reviews.routes.ts',
  },

  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
    build: 'package',
  })
    .skip(['@ermulaku/dashboard-kit', '@ermulaku/types'])
    .patch(['@angular/*'], { includeSecondaries: { keepAll: true } })
    .get(),

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
