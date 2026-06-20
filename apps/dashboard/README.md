# @ermulaku/dashboard

The TutorHub **tutor dashboard** — a React 19 + Redux Toolkit SPA on a
**hand-written Webpack 5** build (SPEC §10). It talks to `services/api` over REST
(via RTK Query) and receives **live booking updates** over Socket.IO.

## Features

- **Availability calendar** — a week grid showing each tutor's working-hours
  bands and their bookings (positioned in the tutor's timezone).
- **Set working hours** — per-day editor that persists via `PATCH /tutors/:id`.
- **Booking management** — confirm / complete / cancel / no-show, with only the
  legal transitions offered (mirrors the API state machine).
- **Live updates** — a Socket.IO subscription refreshes the cache whenever a
  booking changes, so the calendar and list update without a refresh.

## Build tooling (custom Webpack 5)

`webpack.config.mjs` is written from scratch: `ts-loader` for TS/JSX, CSS
(style-loader in dev / `MiniCssExtractPlugin` in prod), **SVGR** (SVGs as React
components), code-splitting (`splitChunks` + `runtimeChunk`), **env injection**
via `DefinePlugin` (`API_URL`), and an opt-in **bundle analyzer**.

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

- **State** — Redux Toolkit store: a `ui` slice (selected tutor) + the RTK Query
  `api` slice (`store/api.ts`). The live socket hook (`features/live`) invalidates
  the `Booking` cache tag to trigger refetches.
- **Types** — shares `@ermulaku/types` with the API for the domain shapes.
