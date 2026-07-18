# @ermulaku/dashboard

The TutorHub **tutor dashboard** — a React 19 + Redux Toolkit SPA on a
**hand-written Webpack 5** build (SPEC §10). Tutors sign up, onboard, and run their
whole business here: calendar, lessons, catalog, availability, messaging, earnings,
marketing, reviews, analytics, and settings. It talks to `services/api` via **RTK
Query** (over both the REST and GraphQL endpoints) and receives **live booking
updates** over Socket.IO. The UI is themed with `@ermulaku/ui` tokens (light/dark +
Teal / Indigo / Plum accents).

## Tutor auth & onboarding

- `/signup` · `/login` — tutor accounts. The JWT carries `kind: 'tutor'`, and the
  marketplace's **"Become a tutor"** CTA links here (`/signup`).
- `/onboarding` — a multi-step wizard where a new tutor completes and publishes
  their profile (subjects & packages, working hours, …) before entering the app.
- Everything under `/dashboard` requires a tutor session.

Seeded tutor for local dev: **`lena@tutor.example.com` / `password123`**
(or `POST /auth/tutor/dev-login`).

## Modules

| Route           | What                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| `/dashboard`    | Overview — today's lessons, stats, setup banner, latest review                 |
| `/calendar`     | Week calendar of working-hours bands + bookings (tutor timezone), New-lesson   |
| `/lessons`      | Booking management — confirm / complete / cancel / no-show (API state machine) |
| `/messages`     | Real-time messaging with students                                              |
| `/catalog`      | Subjects & packages the tutor offers                                           |
| `/availability` | Weekly working-hours editor                                                    |
| `/earnings`     | Earnings & Stripe payouts                                                      |
| `/marketing`    | Promotions and marketing tools                                                 |
| `/reviews`      | Student reviews                                                                |
| `/analytics`    | Performance analytics                                                          |
| `/settings`     | Account, booking rules, theme / accent                                         |

- **Live updates** — a Socket.IO subscription invalidates the RTK Query `Booking`
  cache tag when a booking changes, so the calendar and lists refresh without a reload.

## Build tooling (custom Webpack 5)

`webpack.config.mjs` is written from scratch: `ts-loader` for TS/JSX, CSS
(style-loader in dev / `MiniCssExtractPlugin` in prod), **SVGR** (SVGs as React
components), code-splitting (`splitChunks` + `runtimeChunk`), **env injection**
via `DefinePlugin` (`API_URL`, inlined at build time), and an opt-in **bundle analyzer**.

## Prerequisites

The API must be running (see [`services/api`](../../services/api/README.md)):

```bash
docker compose up -d db
npm run db:deploy -w @ermulaku/api && npm run db:seed -w @ermulaku/api
npm run start:dev -w @ermulaku/api      # API on :4000
```

## Run

```bash
npm run dev -w @ermulaku/dashboard       # webpack-dev-server on :3100
```

Set `API_URL` to point at a non-default API, e.g. `API_URL=http://localhost:4000`.
In production it is inlined at **build** time, so changing it needs a redeploy.

## Scripts

```bash
npm run dev        # dev server (HMR) on :3100
npm run build      # production bundle → dist
npm run analyze    # production build + bundle-analyzer report (dist/report.html)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src test
npm test           # jest + React Testing Library (jsdom)
```

## Architecture

- **State** — Redux Toolkit store: `ui` + `auth` slices plus the RTK Query `api`
  slice (`store/api.ts`), whose base query handles **both REST and GraphQL**
  (GraphQL ops POST to `/graphql`, unwrap `data`, surface `errors`; a `401` or a
  GraphQL auth error clears the session). The live socket hook (`features/live`)
  invalidates the `Booking` cache tag to trigger refetches.
- **Types** — shares `@ermulaku/types` with the API for the domain shapes.

## Deployment

Built and deployed to **Vercel** as a static SPA by
`.github/workflows/deploy-dashboard.yml`. See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).
