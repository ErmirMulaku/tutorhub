# Micro frontends — the dashboard shell and the Reviews remote

The tutor dashboard (`apps/dashboard-ng`) is a **Native Federation** host. Its `/reviews` page is
not part of its build: it comes from **`apps/dashboard-reviews`**, a separate Angular app that is
built and deployed on its own and loaded by the dashboard **at runtime**. Everything else is the
same app as before. A tutor sees no difference, except that `/reviews` now comes from another
deployment.

Versions: Angular 22.2.3, `@angular-architects/native-federation` 22.2.4 (Native Federation v4,
its Angular 22 release), NgRx 22, RxJS 7.8.

## 1. What lives where

```
                         Browser
┌───────────────────────────────────────────────────────┐
│ SHELL  apps/dashboard-ng   (dynamic host, :3100)      │
│  topbar · sidebar · auth · NgRx root store · HTTP     │
│  /dashboard /calendar /lessons ...  (local, lazy)     │
│  /reviews ──► remote './routes' (or the fallback)     │
└───────────────────────────┬───────────────────────────┘
                            │ runtime fetch
              federation.manifest.json → remoteEntry.json
                            ▼
┌───────────────────────────────────────────────────────┐
│ REMOTE  apps/dashboard-reviews  (remote, :3101)       │
│  exposes './routes' → REVIEWS_ROUTES                  │
│  ReviewsPage + ReviewsApi + review models + styles    │
└───────────────────────────────────────────────────────┘
   shared singletons: @angular/*, @ngrx/*, rxjs, tslib,
                      @ermulaku/dashboard-kit
```

| Where                                                | What                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/dashboard-ng`                                  | The shell: layout, auth, the root NgRx store, HttpClient + auth interceptor, the other 10 pages, and `core/federation/` (loading remotes, the fallback).                                                                           |
| `apps/dashboard-reviews`                             | The Reviews page, its API service, models, CSS and spec. `src/app/reviews.routes.ts` is the only thing the shell loads. `app.config.ts` / `app.ts` exist only for **standalone mode** (opened on :3101 directly, for development). |
| `packages/dashboard-kit` (`@ermulaku/dashboard-kit`) | What both apps need at runtime: auth store + interceptor, `GraphqlClient`, `CacheTags` / `cachedQuery`, `errors`, `format`, `ToastService`, the UI primitives the page renders, and the `API_BASE_URL` token.                      |

Both apps share one copy of the kit, so there is exactly one `ToastService`, one `CacheTags` and
one auth store. A reply posted in the remote shows the shell's toast and refreshes the shell's
"Latest review" card.

## 2. How it works at runtime

1. **`main.ts`** (shell) calls `initFederation('federation.manifest.json')` before Angular starts.
   The manifest maps remote names to URLs (`{ "reviews": ".../remoteEntry.json" }`).
2. Native Federation fetches each remote's **`remoteEntry.json`** (what it exposes and which
   shared packages it needs, with versions) and the shell's own. It then writes an **import map**,
   so that `@angular/core`, `@ngrx/store`, `@ermulaku/dashboard-kit`, … resolve to the shell's
   bundles. The shell's versions win; a remote built against another version would not load
   (`strictVersion`), rather than run a second Angular.
3. Only then is the app loaded from **`bootstrap.ts`**. The result of `initFederation()` is
   provided as the `FEDERATION` token. v4 deprecates the global `loadRemoteModule`, which is
   also typed `any`; the instance's version is typed `unknown`.
4. `/reviews` is declared with **`remoteRoutes()`** (`core/federation/federation.ts`) as two routes
   on the same path:
   - The remote's routes, whose **`canMatch`** loads `./routes` from the remote, then `loadChildren`
     returns `REVIEWS_ROUTES`.
   - The fallback (`RemoteUnavailable`), matched when that load failed.
5. The remote's routes run inside the shell's injector: its router, HttpClient (so the auth
   interceptor adds the token), NgRx store and kit services. `API_BASE_URL` comes from the shell,
   not from the remote's build.

**When something fails** — each of these was reproduced in a browser:

| Failure                                            | What the tutor sees                                      | How it recovers                                                                                                                                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote down when the shell starts                  | "Reviews is temporarily unavailable" + Retry, in layout  | The remote was skipped at start-up. Retry (or navigating to the page again) re-runs `canMatch`, which re-reads the manifest, registers the remote (`initRemoteEntry`) and loads it **in place**.                                            |
| Remote goes down after start-up, before `/reviews` | Same fallback                                            | The module's fetch failed, and es-module-shims keeps that failure for the life of the page (no public API to evict it). Retry tries in place first; if the fallback is still showing, it **reloads the page**.                              |
| `federation.manifest.json` can't be fetched        | The whole dashboard works; `/reviews` shows the fallback | `initFederation()` rejects _before_ writing the import map, which would leave the shell's own Angular imports unresolvable (a blank page). So `main.ts` starts again with no remotes. Once the manifest is back, `/reviews` loads in place. |

The rest of the dashboard works in all three cases. Our code logs one line per failed attempt;
the Native Federation runtime logs its own lines as well.

## 3. Run, build, deploy

```bash
npm run dev:mfe                       # both dev servers via Nx: shell :3100 + remote :3101
# then sign in on http://localhost:3100 and open /reviews

npx nx build @ermulaku/dashboard-ng       # → apps/dashboard-ng/dist/dashboard-ng/browser
npx nx build @ermulaku/dashboard-reviews  # → apps/dashboard-reviews/dist/dashboard-reviews/browser
```

- **Dev manifest:** `apps/dashboard-ng/public/federation.manifest.json` →
  `http://localhost:3101/remoteEntry.json`.
- **Prod manifest:** written **after** the build from `REVIEWS_REMOTE_URL`
  (`apps/dashboard-ng/scripts/write-federation-manifest.mjs`). The build fails without it, like
  `API_URL`. The remote's URL is never compiled into the shell.
- **Standalone remote** (`npm run dev -w @ermulaku/dashboard-reviews`, :3101): a banner says to
  open it through the dashboard. It has its own router and store but no session (another origin,
  another `localStorage`), so its API calls are unauthenticated.
- **Dev servers write to `dist/<app>-dev`.** In dev mode the federation builder writes the shared
  bundles to disk and serves them from there. Sharing `dist/<app>` with a production build swapped
  production Angular in under the running dev app (`ngDevMode is not defined`).
- **Deploy:** two Vercel projects, two workflows (`deploy-dashboard.yml`,
  `deploy-dashboard-reviews.yml`). One-time setup is in [`DEPLOYMENT.md`](./DEPLOYMENT.md) →
  "First deploy of the Reviews remote".
  - The remote sends `Access-Control-Allow-Origin: *` and `no-cache` on `remoteEntry.json`.
  - All JS in both apps is content-hashed and cached immutably; the JSON files are revalidated.
  - A change to `packages/dashboard-kit` redeploys both apps.

**Independent-deploy check** (local, two production builds served statically):

```bash
npx nx run-many -t build -p @ermulaku/dashboard-ng @ermulaku/dashboard-reviews
REVIEWS_REMOTE_URL=http://localhost:3201 node apps/dashboard-ng/scripts/write-federation-manifest.mjs
node scripts/serve-static.mjs apps/dashboard-ng/dist/dashboard-ng/browser 3200 &
node scripts/serve-static.mjs apps/dashboard-reviews/dist/dashboard-reviews/browser 3201 --cors &
```

I renamed the "Needs reply" tab to "Awaiting reply" in the remote and rebuilt **only** the remote.
A plain reload of `http://localhost:3200/reviews` showed the new label, loaded from a new
`routes-*.js` hash. A checksum of the shell's whole output folder was identical before and after.

## 4. Trade-offs

- **Bigger, slower first load (the main cost).** The shell can't tree-shake what it shares,
  because a remote may use any part of Angular. Each shared package ships whole; `@angular/core`
  alone is 96 kB gzip. On top of that, shim mode discovers modules one level at a time: HTML →
  main → manifest → `remoteEntry.json` → shared bundles → their imports. See §5. Ways to claw this
  back, none done here:
  - Preload the shared bundles from `index.html`, which needs a build step to inject the hashed
    names.
  - Native import maps (`shimMode: false`). Supported by current browsers, but this gives up
    `initRemoteEntry`, which the retry relies on.
  - Not federating a page this small.
- **Shared singletons with strict versions.** One Angular, one store, one kit: needed for one
  `ToastService` and one auth token. The price is that Angular / NgRx / RxJS upgrades must ship
  in **both** apps together. A remote on another version fails to load and shows the fallback by
  design, rather than running two Angulars.
- **The kit is a contract.** The shell's copy of the kit is the one that runs. While a kit change
  is deploying, the remote's new code can run against the shell's old kit (or the other way
  round), so kit changes must stay backward-compatible for one deploy.
- **Runtime failure modes.** A missing remote no longer fails the build; it fails in the browser,
  hence the fallback, the retry and the tests for them.
- **CORS + caching.** The remote serves another origin, so it needs CORS. `remoteEntry.json`
  changes on every deploy and must never be cached immutably.
  - I used `*` rather than the shell's single origin. These are public, cookie-free static files
    anyone can fetch directly, so CORS protects nothing here, and a single origin would break the
    shell's preview deployments.
- **More moving parts.** A second app, a second Vercel project and pipeline, a manifest per
  environment, a shared library, two dev servers for E2E.
- **When it's not worth it.** For one team and one codebase, a lazy route gives the same code
  splitting with none of this cost. Micro frontends pay off when separate teams need to release
  separately: deploy cadence, ownership, a big app built in parts. That is not the case for one
  developer and one page. This setup is a working demo of the mechanics, honestly measured.

## 5. Measured

Production builds, served locally with gzip (`scripts/serve-static.mjs`), against the pre-change
build of `master` served the same way:

|                                                                  | Before (one app)                       | After (shell + remote)                                                      |
| ---------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Angular "initial" (its budget view)                              | 359.3 kB raw                           | 184.8 kB raw: Angular/NgRx/RxJS left this count, they're shared bundles now |
| `shell-routes` chunk                                             | 75.0 kB                                | 28.4 kB: NgRx entity/effects and the kit are shared now                     |
| JS loaded for `/login` (gzip -9, every file the browser fetched) | **115.4 kB**, 8 files                  | **298.6 kB**, 33 files                                                      |
| … + sign in → `/dashboard`                                       | 146.6 kB                               | 329.9 kB                                                                    |
| … + open `/reviews`                                              | 149.7 kB (+3.0)                        | 333.2 kB (+3.3, from the remote: `routes-*.js`)                             |
| Lighthouse mobile, `/login` (median of 3)                        | **97**, LCP 2.3 s, 12 requests, 164 kB | **81**, LCP 4.4 s, 70 requests, 357 kB                                      |
| Remote, per visit to `/reviews`                                  | —                                      | `remoteEntry.json` 3.5 kB + `routes-*.js` 11.6 kB raw / 3.3 kB gzip         |

The `/reviews` page renders identically to before. A style fingerprint of all 77 elements
(position, size, 17 computed properties) showed no difference against the old build.

The Angular budgets in `angular.json` were **tightened** (initial 420 → 230 kB, all scripts 700 →
500 kB, `shell-routes` 100 → 45 kB): the shared bundles moved out of what they count, and the old
limits would have let the app's own code double unnoticed. The shared bundles themselves have no
budget; the table above is how they're tracked.
