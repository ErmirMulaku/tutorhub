# Spec: Native Federation demo — dashboard shell + Reviews remote

> Goal: turn the Angular tutor dashboard (`apps/dashboard-ng`) into a **micro-frontend
> setup** with **Native Federation**: the existing app becomes the **shell (host)**, and the
> **Reviews** feature moves into a **separately built and separately deployed remote app**
> that the shell loads **at runtime**.
>
> Why: real, honest experience with micro frontends / Native Federation for Angular job
> applications (KODE Labs asks for it). This is a personal project — keep it small, correct,
> and easy to explain in an interview. Not a rewrite.

---

## 0. Ground rules (read first)

- **Work in a git worktree on a new branch** `feat/native-federation`. `master` has
  uncommitted, unrelated work in `services/api`, `docs/` and `.github/workflows/deploy-api.yml`
  — do **not** touch, stash, commit or revert any of it.
- Follow `AGENTS.md` (verification checklist) and the repo's conventional commits
  (`commitlint`). **One commit per phase.** Don't push, open a PR or merge to `master`
  until I say so.
- **Stop and report after Phase 0**, and wait for my OK before changing code.
- Check current docs before using any API: use the Context7 MCP (or the official docs) for
  `@angular-architects/native-federation` and Angular 22. Don't rely on memory —
  config file names and options change between versions.
- Don't change the look or behaviour of any page. A tutor using the dashboard should not
  notice anything, except that `/reviews` now comes from another deployment.
- Don't break: the other 10 shell routes, NgRx slices, the auth interceptor, the live
  Socket.IO updates, existing Karma specs, Cypress E2E, lint, typecheck, budgets.
- Keep it honest: if something in this spec turns out to be wrong for Native Federation /
  Angular 22, **say so and propose the fix** instead of forcing it.

## 1. Current state (as found)

- Monorepo: npm workspaces + Nx 23. Apps: `apps/dashboard-ng` (Angular 22.2.3, zoneless,
  signals, standalone, NgRx 22, RxJS 7.8, Karma/Jasmine, Cypress 15), `apps/marketplace`,
  `apps/mobile`, `apps/dashboard` (old React — leave alone).
- `apps/dashboard-ng` has its own `angular.json` (builder `@angular/build:application`),
  dev port **3100**, `API_URL` inlined at build time via `define`, deployed to Vercel by
  `.github/workflows/deploy-dashboard.yml` (CLI runs from repo root; see the comments in
  that file).
- Routing: `app.routes.ts` → lazy `layout/shell.routes.ts` (`SHELL_ROUTES`), which registers
  the `dashboard` + `bookings` NgRx slices and lazy-loads 11 pages, including
  `reviews` → `features/reviews/reviews-page.ts`.
- Reviews page depends on: `core/api/reviews-api.ts` (GraphQL via `GraphqlClient`),
  `core/api/cache-tags.ts`, `core/api/errors.ts`, `core/api/models.ts`
  (`ReviewFilter`, `TutorReview`, `ReviewSummary`), `core/format.ts` (`dayOf`),
  shared UI (`avatar`, `button`, `card`, `error-state`, `segmented-tabs`, `skeleton`,
  `star-rating`, `toast`). `GraphqlClient` and `auth.interceptor` inject the NgRx `Store`
  (`authFeature`, `AuthActions`). It has a spec: `reviews-page.spec.ts`.

## 2. Target architecture

```
                         Browser
┌───────────────────────────────────────────────────────┐
│ SHELL  apps/dashboard-ng   (dynamic host, :3100)      │
│  topbar · sidebar · auth · NgRx root store · HTTP     │
│  /dashboard /calendar /lessons ...  (local, lazy)     │
│  /reviews ──► loadRemoteModule('reviews','./routes')  │
└───────────────────────────┬───────────────────────────┘
                            │ runtime fetch
              federation.manifest.json → remoteEntry.json
                            ▼
┌───────────────────────────────────────────────────────┐
│ REMOTE  apps/dashboard-reviews  (remote, :3101)       │
│  exposes './routes' → REVIEWS_ROUTES                  │
│  ReviewsPage + ReviewsApi (own code)                  │
└───────────────────────────────────────────────────────┘
   shared singletons: @angular/*, @ngrx/*, rxjs,
                      @ermulaku/dashboard-kit
```

Key decisions (confirm or challenge in Phase 0):

1. **Dynamic host + manifest.** The shell reads `federation.manifest.json` at startup
   (`initFederation('federation.manifest.json')`), so the remote URL is **not** baked into the
   shell build. Dev manifest → `http://localhost:3101/remoteEntry.json`; production manifest
   → the remote's Vercel URL. Changing the remote never needs a shell rebuild.
2. **Expose routes, not a component.** The remote exposes `./routes` (`REVIEWS_ROUTES`), and
   the shell mounts it with `loadChildren`. The remote owns its own sub-routing.
3. **One store, one HttpClient.** The remote does **not** call `provideStore`,
   `provideHttpClient` or `provideRouter` when loaded by the shell. It runs inside the
   shell's injector, so it uses the shell's NgRx store, auth token and interceptor. This
   only works if `@angular/*`, `@ngrx/*`, `rxjs` and the shared kit are **singletons**.
4. **Shared workspace library `packages/dashboard-kit`** (`@ermulaku/dashboard-kit`) for code
   both apps need: auth store pieces needed by the client (`authFeature`, `AuthActions`),
   `GraphqlClient`, `CacheTags`/`cachedQuery`, `errors`, `format`, the shared UI components
   the Reviews page uses, and `ToastService`. It is shared as a **singleton**: there must be
   exactly one `ToastService` and one `CacheTags` at runtime, or toasts/caching break across
   the boundary. Move what the remote needs; the shell imports the moved code from the kit
   too (no duplicates). Keep the move minimal. Don't move unrelated code "while you're there".
5. **API URL via an `InjectionToken`, not `define`, inside the kit.** Add
   `API_BASE_URL = new InjectionToken<string>(...)` in the kit; the shell provides it from
   its existing build-time `API_URL`. Kit code (`GraphqlClient`, interceptor check) reads the
   token. Reason: a shared, pre-bundled singleton must not depend on one app's `define`.
6. **Reviews-specific code lives in the remote:** `ReviewsPage`, its template/styles,
   `ReviewsApi`, the review models, and `reviews-page.spec.ts`.
7. **Resilience:** if the remote can't load (down, 404, CORS, network), the shell shows a
   friendly "Reviews is temporarily unavailable — Retry" state inside the normal layout,
   **not** a blank screen or a broken router. Log the error once to the console.
8. **Version policy:** shared packages use `singleton: true, strictVersion: true,
requiredVersion: 'auto'`. Both apps pin the **same** Angular/NgRx/RxJS versions.

## 3. Phases

### Phase 0 — Investigate and report (no code changes)

1. Find the `@angular-architects/native-federation` version that supports **Angular 22**
   (peer deps) and confirm it works with the `@angular/build:application` builder,
   **zoneless** apps, Karma via `@angular/build:unit-test`, and npm workspaces.
   **If there is no Angular 22–compatible release, stop and tell me.**
2. Read the docs for: `ng add` schematic (`--type dynamic-host` / `--type remote`),
   `federation.config.js` (`shareAll`, `skip`, `sharedMappings` / workspace libs),
   `initFederation`, `loadRemoteModule`, and how the dev server and the build output change
   (`remoteEntry.json`, `bootstrap.ts`).
3. Check how a **workspace package** (like `packages/types`, which builds to `dist/` and is
   also mapped in `tsconfig.base.json` paths) should be shared — via tsconfig path mapping
   (source) or as a built package. Recommend one for `dashboard-kit`.
4. Measure the **current** shell production build and write the numbers down
   (initial total, `shell-routes` chunk, total JS, Lighthouse mobile perf if quick).
5. Report: chosen package version, the exact file list you'll add/move/change, anything in
   this spec that's wrong, and the risks. **Wait for my OK.**

### Phase 1 — Extract `packages/dashboard-kit` (no federation yet)

- Create the library with `package.json` (`@ermulaku/dashboard-kit`, private), `tsconfig`,
  `src/index.ts` barrel, following how `packages/types` is set up.
- Move the shared pieces (section 2, decision 4) and add `API_BASE_URL` (decision 5).
- Update the shell's imports. Move any existing specs for moved code with it, and run them.
- **Done when:** the dashboard works exactly as before; `npm run typecheck`, `lint`, `test`
  (all Karma specs), and Cypress pass; prod build within budgets. Commit:
  `refactor(dashboard): extract shared dashboard-kit library`.

### Phase 2 — Make the shell a dynamic host

- Run the Native Federation `ng add` for `dashboard-ng` as **dynamic-host** on port **3100**.
  Review every file it changes (`angular.json`, `main.ts` → `bootstrap.ts`, new
  `federation.config.js`, `public/federation.manifest.json`).
- Keep zoneless. Keep the existing `define`/`API_URL`, `fileReplacements`, test config and
  `vercel.json` working.
- Configure sharing (decision 8). Skip packages the remote never needs if the docs advise it
  (e.g. `socket.io-client`), and explain why.
- **Done when:** the shell runs with an empty/placeholder manifest exactly as before, all
  tests pass. Commit: `feat(dashboard): enable native federation as dynamic host`.

### Phase 3 — Create the Reviews remote

- New Angular 22 app `apps/dashboard-reviews` (package `@ermulaku/dashboard-reviews`),
  same conventions as `dashboard-ng`: standalone, zoneless, SCSS, `th` prefix, Karma,
  ESLint, `typecheck`/`lint`/`test` scripts so Nx picks it up. Dev port **3101**.
- Run `ng add` for it as **remote**. Expose `'./routes': './src/app/reviews.routes.ts'`
  exporting `REVIEWS_ROUTES` (default path → `ReviewsPage`).
- Move `ReviewsPage`, `ReviewsApi`, review models and `reviews-page.spec.ts` into it;
  import shared code from `@ermulaku/dashboard-kit`.
- **Standalone mode** (remote opened directly on :3101, for local dev only): its own
  `app.config.ts` provides the router, `HttpClient` + kit interceptor, root store with
  `authFeature`, and `API_BASE_URL`. Show a small banner "Standalone mode — open through the
  dashboard (:3100) to sign in". Must never be used when loaded by the shell.
- In the shell: replace the `reviews` route with
  `loadChildren: () => loadRemoteModule('reviews', './routes').then(m => m.REVIEWS_ROUTES)`
  (with the fallback from Phase 4), and delete the old local Reviews files.
- Dev manifest: `reviews` → `http://localhost:3101/remoteEntry.json`.
- Add a root script to run both: e.g. `npm run dev:mfe` (shell :3100 + remote :3101 in
  parallel via Nx or `concurrently` — prefer Nx if it works without new deps).
- **Done when:** `npm run dev:mfe` → sign in on :3100 → `/reviews` renders, loads data,
  filters work, replying works (toast shows — proves the singleton `ToastService`), and the
  Network tab shows `remoteEntry.json` + remote chunks fetched from :3101. Sidebar,
  notifications and live updates still work. Commit:
  `feat(dashboard-reviews): add reviews micro frontend remote`.

### Phase 4 — Resilience and tests

- Fallback component in the shell (decision 7), used when `loadRemoteModule` rejects, with
  a **Retry** button that re-attempts the load. Also handle the manifest itself failing:
  the shell must still start without the remote.
- Karma (shell): a spec for the fallback route behaviour (remote load rejects → fallback
  component renders).
- Karma (remote): the moved `reviews-page.spec.ts` passes in the remote project.
- Cypress (shell): (a) `/reviews` loads via the remote and shows reviews (stub the API as
  the existing E2E tests do); (b) intercept `**/remoteEntry.json` with a 404 → the fallback
  shows inside the layout, and another page (e.g. `/dashboard`) still works.
- **Done when:** all old + new tests pass in CI mode. Commit:
  `test(dashboard): cover remote loading and remote-down fallback`.

### Phase 5 — Build, budgets, deployment

- Rebuild both in production. Compare with the Phase 0 numbers and report honestly:
  shell initial JS before/after, remote size, shared chunks. Adjust budgets in
  `angular.json` only if federation genuinely moved bytes around (e.g. the
  `shell-routes` bundle name may change); explain each change in a comment. Don't hide
  a real regression by raising a limit.
- Remote on **Vercel** as a new project (free plan): `apps/dashboard-reviews/vercel.json`
  modelled on the shell's (install/build from repo root, output dir,
  SPA rewrite), plus **CORS headers** (`Access-Control-Allow-Origin` for the shell's
  production origin) on `remoteEntry.json` and the JS chunks, and short caching on
  `remoteEntry.json` (it must not be cached immutably — it changes every deploy).
- Shell production manifest points `reviews` at the remote's production URL. Decide (and
  explain) how dev vs prod manifest is selected — e.g. a small build step that writes
  `federation.manifest.json` from an env var `REVIEWS_REMOTE_URL`, failing the build if
  it's missing (same style as `API_URL` in `vercel.json`).
- CI: add the new app to `ci.yml` checks; add `.github/workflows/deploy-dashboard-reviews.yml`
  mirroring `deploy-dashboard.yml` (secret/var names: `VERCEL_PROJECT_ID_DASHBOARD_REVIEWS`),
  triggered by `apps/dashboard-reviews/**` and `packages/dashboard-kit/**`. Update
  `deploy-dashboard.yml` paths so a kit change redeploys both.
- **Write down the manual steps for me** (create the Vercel project, set Root Directory,
  env vars, GitHub vars) — don't try to click through Vercel yourself.
- Commit: `ci(dashboard-reviews): deploy remote independently to vercel`.

### Phase 6 — Docs and proof of independent deploys

- `docs/MICRO_FRONTENDS.md`, short and simple:
  1. Diagram (section 2) and what lives where.
  2. How it works at runtime (manifest → remoteEntry → shared singletons → routes).
  3. How to run locally, build, deploy.
  4. **Trade-offs** I chose and their cost: shared singletons + strict versions (upgrade
     both together), runtime failure → fallback, CORS + caching of `remoteEntry.json`,
     extra build/deploy pipeline, when micro frontends are **not** worth it (small team).
  5. Measured numbers from Phase 5.
- Update `README.md` (apps list) and `apps/dashboard-ng/README.md`.
- **Independent-deploy check** (do it locally with two prod builds served statically, and
  describe it in the doc): change a visible text in the remote, rebuild **only** the remote,
  reload the shell → the change appears with no shell rebuild.
- Commit: `docs: document the reviews micro frontend`.

## 4. Acceptance criteria (all must be true)

- [ ] `/reviews` in the shell is served by `apps/dashboard-reviews` at runtime (visible in
      the Network tab), and looks and behaves exactly as before.
- [ ] One NgRx store, one auth token flow, one `ToastService` across shell + remote.
- [ ] Remote down → fallback with Retry inside the layout; the rest of the dashboard works.
- [ ] Remote can be rebuilt and redeployed without rebuilding the shell.
- [ ] Zoneless, standalone, signals unchanged. No `any` added.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, Cypress: all green, for both apps.
- [ ] Production budgets pass; before/after numbers reported.
- [ ] Old React `apps/dashboard`, `apps/marketplace`, `apps/mobile`, `services/*` untouched.
- [ ] `docs/MICRO_FRONTENDS.md` written; manual Vercel steps listed for me.

## 5. Final report I want

- What was built, file tree of the new/moved parts.
- Before/after bundle numbers.
- Anything you had to change from this spec, and why.
- 3–5 short, honest interview talking points (what I built, one problem I hit and how it
  was solved, one trade-off).
