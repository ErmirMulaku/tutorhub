# @ermulaku/dashboard-ng

The TutorHub **tutor dashboard, rebuilt in Angular** — a feature-by-feature port of
[`apps/dashboard`](../dashboard/README.md) (React + Redux Toolkit). Same screens, same API calls,
same look; the React app stays live until cutover. Plan and progress:
[`docs/DASHBOARD_ANGULAR_MIGRATION.md`](../../docs/DASHBOARD_ANGULAR_MIGRATION.md).

**Stack:** Angular 22 (standalone components, signals, **zoneless**), Angular CLI with the
esbuild `application` builder, RxJS, NgRx, SCSS, **Jasmine + Karma** for unit
tests, Cypress for E2E (Phase 7).

## Run

The API must be running (see [`services/api`](../../services/api/README.md)), then:

```bash
npm run dev -w @ermulaku/dashboard-ng       # ng serve on :3300
```

The React app uses :3100 and the marketplace :3200, so all three can run side by side.

## Scripts

```bash
npm run dev         # dev server (Vite, HMR) on :3300
npm run build       # production build → dist/dashboard-ng/browser
npm run typecheck   # ngc (templates too, strictTemplates) + tsc for the specs
npm run lint        # eslint + angular-eslint (TS and template rules)
npm test            # Jasmine on Karma, headless Chrome, single run
npm run test:watch  # Karma in a real Chrome window, re-runs on save
```

All of them run through Nx too (`npx nx run-many -t lint typecheck test build`).

## Configuration

`API_URL` is inlined at **build** time through the application builder's `define` option — the
Angular equivalent of the React app's Webpack `DefinePlugin`:

- default: `http://localhost:4000` (`angular.json` → `build.options.define`)
- override: `API_URL=https://api.example.com npm run build`

Read it through `src/environments/environment.ts`, never the global directly. Changing it needs a
rebuild.

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

- **Unit:** `*.spec.ts` next to the code, Jasmine syntax (`describe` / `it` / `expect`), run by
  Karma in Chrome via the `@angular/build:unit-test` builder (`runner: "karma"`). `tsconfig.spec.json`
  only exposes Jasmine's globals, never the repo-root Jest types.
- **Note:** Karma is deprecated upstream and Vitest is Angular's default runner; Karma is used here
  on purpose to learn it.
