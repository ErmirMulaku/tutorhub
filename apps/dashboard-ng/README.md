# @ermulaku/dashboard-ng

The TutorHub **tutor dashboard**, in Angular — a feature-by-feature rewrite of the original React +
Redux Toolkit app, which it replaced in production (the cutover). Same screens, same API calls,
same look. The React app was removed afterwards; its last version is the git tag
**`dashboard-react-final`**, and comments here that say "Port of apps/dashboard/…" refer to files
at that tag. How the migration went: [`docs/DASHBOARD_ANGULAR_MIGRATION.md`](../../docs/DASHBOARD_ANGULAR_MIGRATION.md).

**Stack:** Angular 22 (standalone components, signals, **zoneless**), Angular CLI with the
esbuild `application` builder, RxJS, NgRx, SCSS, **Jasmine + Karma** for unit
tests, **Cypress** for E2E against a fixture API.

**Micro frontends:** this app is a **Native Federation host** (the shell). Its `/reviews` page is
a separately built and deployed remote, [`apps/dashboard-reviews`](../dashboard-reviews), loaded
at runtime; code both need lives in [`packages/dashboard-kit`](../../packages/dashboard-kit). How
it works, the trade-offs and the numbers: [`docs/MICRO_FRONTENDS.md`](../../docs/MICRO_FRONTENDS.md).

## Run

The API must be running (see [`services/api`](../../services/api/README.md)), then:

```bash
npm run dev:mfe                             # shell on :3100 + Reviews remote on :3101 (repo root)
npm run dev -w @ermulaku/dashboard-ng       # the shell alone; /reviews then shows its fallback
```

The marketplace uses :3200. :3100 is the port the marketplace's "Become a tutor" link and the API's
Stripe Connect return URL default to locally.

## Scripts

```bash
npm run dev         # dev server (Vite, HMR, + federation artifacts in dist/dashboard-ng-dev) on :3100
npm run build       # production build → dist/dashboard-ng/browser (fails over a size budget)
npm run typecheck   # ngc (templates too, strictTemplates) + tsc for the specs and Cypress
npm run lint        # eslint + angular-eslint (TS and template rules)
npm test            # Jasmine on Karma, headless Chrome, single run
npm run test:watch  # Karma in a real Chrome window, re-runs on save
npm run e2e         # Cypress, headless (needs `npm run dev:mfe` running; no API needed)
npm run e2e:open    # Cypress's interactive runner
```

All of them run through Nx too (`npx nx run-many -t lint typecheck test build`).

## Configuration

`API_URL` is inlined at **build** time through the application builder's `define` option — the
Angular equivalent of the React app's Webpack `DefinePlugin`:

- default: `http://localhost:4000` (`angular.json` → `build.options.define`)
- override: `API_URL=https://api.example.com npm run build`

Read it through `src/environments/environment.ts`, never the global directly. Changing it needs a
rebuild. The shared kit gets it through the `API_BASE_URL` token (`app.config.ts`) instead: a
bundle shared with remotes can't depend on this app's `define`.

Remotes are listed in `public/federation.manifest.json` (development: the Reviews remote on
`:3101`). Production writes it after the build from `REVIEWS_REMOTE_URL`
(`scripts/write-federation-manifest.mjs`), so moving the remote needs no rebuild of this app's
code.

Redux DevTools are registered only in **development** builds: `angular.json` swaps
`src/environments/dev-tools.ts` (no providers) for `dev-tools.development.ts` there, so production
never bundles them. Size budgets (initial 230 kB, all scripts 500 kB, the post-login
`shell-routes` chunk 45 kB — errors; warnings a little lower) live in the production
configuration. They count this app's own bundles only — Angular, NgRx, RxJS and the kit are shared
federation bundles now (see `docs/MICRO_FRONTENDS.md` §5).

## Layout

```
src/
  main.ts                    initFederation(manifest) → then loads bootstrap.ts
  bootstrap.ts               bootstrapApplication(App, …) with the federation result as FEDERATION
  app/
    app.ts                   root: <router-outlet> + theme/accent → <html> (signal effect)
    app.config.ts            router, HttpClient + auth interceptor, NgRx store/effects/devtools
    app.routes.ts            route table — every screen lazy (loadComponent)
    core/
      auth/                  NgRx auth feature + effects, interceptor, guards, AuthApiService
      ui/                    NgRx ui feature (theme, accent, online, drawer, modal) + effects
      api/                   per-feature API services and response models
      federation/            remoteRoutes() (remote route + fallback), RemoteModules, the fallback page
      validation.ts, nav.ts  framework-free helpers ported from React
    layout/                  Shell, Sidebar (aside[th-sidebar]), Topbar (header[th-topbar])
    shared/                  Icon, KPI stat, charts, modal, … — this app's own components
                             (Button, Card, Avatar, Toast, GraphqlClient, auth store, format …
                             live in packages/dashboard-kit, shared with the remotes)
    features/<screen>/       one folder per route (/reviews is the remote's)
  environments/              API_URL
  styles.scss + styles/      tokens → primitives → app (ported verbatim)
```

The styles are copied verbatim with the same class names, so templates render identically to the
React app. `packages/ui` itself is React-only and is not used here.

## Tests

- **Unit (130 specs, including `packages/dashboard-kit`'s — the kit has no Angular build of its
  own, so `angular.json` → `test.include` runs its specs here):** `*.spec.ts` next to the code, Jasmine syntax (`describe` / `it` /
  `expect`), run by Karma in Chrome via the `@angular/build:unit-test` builder
  (`runner: "karma"`). `tsconfig.spec.json` only exposes Jasmine's globals, never the repo-root
  Jest types. Covered: NgRx reducers, selectors and effects (functional effects called directly,
  marble tests for `switchMap` vs `mergeMap`), the interceptor and GraphQL client
  (`HttpTestingController`), guards, `cachedQuery` / `CacheTags`, the socket service (fake socket),
  and components (`fakeAsync` for the modal and toasts, Reactive Forms through the DOM, MockStore).
- **zone.js for tests only:** the test target builds with `build:test`, whose polyfills add
  `zone.js` so `fakeAsync` / `tick` work. The builder then also defaults TestBed to zone change
  detection, so `src/test-setup.ts` (a global `beforeEach`) switches every TestBed back to
  zoneless — tests run the way the app does. The production build never ships zone.js.
- **E2E (12 tests, two of them for the Reviews remote — loaded from :3101, and the fallback when
  its `remoteEntry.json` is a 404):** `cypress/e2e/*.cy.ts`. There is no backend: one `cy.intercept` answers every
  `/graphql` call by its root field from `cypress/fixtures/graphql.json` (or a per-test override,
  which can be stateful), aliased by that name (`cy.wait('@acceptBooking')`). An operation without
  a fixture fails the test (`cypress/support/e2e.ts`).
- **CI:** Karma runs in the `verify` job (`KARMA_BROWSER=ChromeHeadlessNoSandbox`); Cypress runs in
  the `dashboard-ng-e2e` job against the shell and Reviews remote dev servers, with failure
  screenshots uploaded.
- **Note:** Karma is deprecated upstream and Vitest is Angular's default runner; Karma is used here
  on purpose to learn it.
