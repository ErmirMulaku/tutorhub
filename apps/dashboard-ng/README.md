# @ermulaku/dashboard-ng

The TutorHub **tutor dashboard, rebuilt in Angular** — a feature-by-feature port of
[`apps/dashboard`](../dashboard/README.md) (React + Redux Toolkit). Same screens, same API calls,
same look; the React app stays live until cutover. Plan and progress:
[`docs/DASHBOARD_ANGULAR_MIGRATION.md`](../../docs/DASHBOARD_ANGULAR_MIGRATION.md).

**Stack:** Angular 22 (standalone components, signals, **zoneless**), Angular CLI with the
esbuild `application` builder, RxJS, NgRx, SCSS, **Jasmine + Karma** for unit
tests, **Cypress** for E2E against a fixture API.

## Run

The API must be running (see [`services/api`](../../services/api/README.md)), then:

```bash
npm run dev -w @ermulaku/dashboard-ng       # ng serve on :3300
```

The React app uses :3100 and the marketplace :3200, so all three can run side by side.

## Scripts

```bash
npm run dev         # dev server (Vite, HMR) on :3300
npm run build       # production build → dist/dashboard-ng/browser (fails over a size budget)
npm run typecheck   # ngc (templates too, strictTemplates) + tsc for the specs and Cypress
npm run lint        # eslint + angular-eslint (TS and template rules)
npm test            # Jasmine on Karma, headless Chrome, single run
npm run test:watch  # Karma in a real Chrome window, re-runs on save
npm run e2e         # Cypress, headless (needs `npm run dev` running; no API needed)
npm run e2e:open    # Cypress's interactive runner
```

All of them run through Nx too (`npx nx run-many -t lint typecheck test build`).

## Configuration

`API_URL` is inlined at **build** time through the application builder's `define` option — the
Angular equivalent of the React app's Webpack `DefinePlugin`:

- default: `http://localhost:4000` (`angular.json` → `build.options.define`)
- override: `API_URL=https://api.example.com npm run build`

Read it through `src/environments/environment.ts`, never the global directly. Changing it needs a
rebuild.

Redux DevTools are registered only in **development** builds: `angular.json` swaps
`src/environments/dev-tools.ts` (no providers) for `dev-tools.development.ts` there, so production
never bundles them. Size budgets (initial 420 kB, all scripts 700 kB, the post-login
`shell-routes` chunk 100 kB — errors; warnings a little lower) live in the production configuration.

## Layout

```
src/
  main.ts                    bootstrapApplication(App, appConfig)
  app/
    app.ts                   root: <router-outlet> + theme/accent → <html> (signal effect)
    app.config.ts            router, HttpClient + auth interceptor, NgRx store/effects/devtools
    app.routes.ts            route table — every screen lazy (loadComponent)
    core/
      auth/                  NgRx auth feature + effects, interceptor, guards, AuthApiService
      ui/                    NgRx ui feature (theme, accent, online, drawer, modal) + effects
      api/                   GraphqlClient (POST /graphql, no Apollo), services, response models
      format.ts, validation.ts, nav.ts   framework-free helpers ported from React
    layout/                  Shell, Sidebar (aside[th-sidebar]), Topbar (header[th-topbar])
    shared/                  Button, Card, Avatar, Icon, Toast — Angular ports of @ermulaku/ui
    features/<screen>/       one folder per route
  environments/              API_URL
  styles.scss + styles/      tokens → primitives → app (ported verbatim)
```

The styles are copied verbatim with the same class names, so templates render identically to the
React app. `packages/ui` itself is React-only and is not used here.

## Tests

- **Unit (124 specs):** `*.spec.ts` next to the code, Jasmine syntax (`describe` / `it` /
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
- **E2E (10 tests):** `cypress/e2e/*.cy.ts`. There is no backend: one `cy.intercept` answers every
  `/graphql` call by its root field from `cypress/fixtures/graphql.json` (or a per-test override,
  which can be stateful), aliased by that name (`cy.wait('@acceptBooking')`). An operation without
  a fixture fails the test (`cypress/support/e2e.ts`).
- **CI:** Karma runs in the `verify` job (`KARMA_BROWSER=ChromeHeadlessNoSandbox`); Cypress runs in
  the `dashboard-ng-e2e` job against the dev server, with failure screenshots uploaded.
- **Note:** Karma is deprecated upstream and Vitest is Angular's default runner; Karma is used here
  on purpose to learn it.
