# @ermulaku/dashboard-reviews

The **Reviews** page of the tutor dashboard as a **Native Federation remote**: built and deployed
on its own, and loaded by the dashboard ([`apps/dashboard-ng`](../dashboard-ng), the host) at
runtime under `/reviews`. How it fits together, the trade-offs and the measurements:
[`docs/MICRO_FRONTENDS.md`](../../docs/MICRO_FRONTENDS.md).

- **Exposes** `./routes` → `REVIEWS_ROUTES` (`src/app/reviews.routes.ts`): the page, its API
  service (`reviews-api.ts`), models and styles.
- **Shares** Angular, NgRx, RxJS and [`@ermulaku/dashboard-kit`](../../packages/dashboard-kit)
  with the host as strict-version singletons (`federation.config.mjs`). Inside the dashboard it
  runs on the host's router, HttpClient, auth interceptor and store — it provides none of its own.

## Run

```bash
npm run dev:mfe        # repo root: the dashboard on :3100 + this remote on :3101
```

Open the page through the dashboard (sign in on :3100, then `/reviews`). Opened directly on
:3101 it runs in **standalone mode** (`src/app/app.config.ts`): its own router and store, a banner,
and no session — that origin's `localStorage` has no token, so API calls are unauthenticated.

## Scripts

```bash
npm run dev         # dev server on :3101 (federation artifacts in dist/dashboard-reviews-dev)
npm run build       # production build → dist/dashboard-reviews/browser (remoteEntry.json + routes-*.js)
npm run typecheck   # ngc (strictTemplates) + tsc for the specs
npm run lint        # eslint + angular-eslint
npm test            # Jasmine on Karma, headless Chrome
```

Deployed to its own Vercel project by `.github/workflows/deploy-dashboard-reviews.yml`;
`vercel.json` adds CORS and keeps `remoteEntry.json` uncached. One-time setup:
[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).
