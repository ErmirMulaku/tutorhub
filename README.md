<!--
  Starter README for the TutorHub flagship.
  Copy this into the repo root as README.md. Fill the TODOs as phases land.
  Keep it current — a maintained README is a graded "documentation" signal.
-->

# TutorHub

A production-grade **tutoring marketplace** — students discover and book lessons; tutors manage a
calendar, bookings, and earnings. Built as a TypeScript monorepo with a Next.js SSR/PWA storefront,
a custom-Webpack React/Redux dashboard, an Expo mobile app, and a NestJS API exposing the same
domain over **REST, GraphQL, and gRPC**.

> Status: 🚧 Phase 6 (AI assistant + monitoring) complete — see [Roadmap](#roadmap).
> Live demo: _TODO_ · API docs: [`docs/API.md`](./docs/API.md) · Storybook: _TODO_

## Why this project

A full, real-world marketplace built to senior standards: clean architecture, documented APIs,
tests, CI, and an [AI-augmented workflow](./AGENTS.md). The booking/availability model mirrors
real scheduling platforms (timezone-correct slots, no-show handling, real-time updates).

## Architecture

```
 marketplace (Next.js)  ┐                       ┌ dashboard (React+Redux, Webpack)
 mobile (Expo)          ┴── GraphQL / REST ──►  │
                                                ▼
                                services/api (NestJS)
                              REST · GraphQL · gRPC
                                ├─ gRPC ─► notifications (Elixir)
                                └─────────► PostgreSQL (Prisma)
   real-time: WebSocket events → dashboard (live bookings)
```

Full design and decisions: [`SPEC.md`](./SPEC.md) and [`docs/`](./docs).

## Tech stack

TypeScript · React 19 + Redux Toolkit · Next.js 15 (SSR/PWA) · custom Webpack 5 + esbuild ·
NestJS 11 · GraphQL (Apollo) + gRPC · PostgreSQL + Prisma · Socket.IO · i18n + RTL ·
Expo / React Native · Elixir/Phoenix (notifications) · Jest + Cypress · GitHub Actions +
Lighthouse CI · Storybook · OpenAI (booking assistant) · Google Cloud Run + Cloud SQL.

## Monorepo

| Path                                    | What                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `apps/marketplace`                      | Next.js student app (SSR, PWA, RTL, GPU-only animations)   |
| `apps/dashboard`                        | React + Redux tutor dashboard (custom Webpack)             |
| `apps/mobile`                           | Expo / React Native student app                            |
| `services/api`                          | NestJS — REST + GraphQL + gRPC over Postgres               |
| `services/notifications`                | Elixir/Phoenix — lesson reminders                          |
| `packages/slot-engine`                  | timezone-aware availability engine ([published to npm](#)) |
| `packages/ui`                           | shared component library + Storybook                       |
| `packages/types`, `packages/api-client` | shared TS types & typed client                             |

## Getting started

> **Built so far (Phases 1–6):** `packages/types`, `packages/slot-engine`, `packages/ui`
> (RTL-safe components + Storybook), the `services/api` NestJS API (Postgres + Prisma)
> exposing the domain over **REST, GraphQL, and gRPC** — with health/readiness probes,
> Prometheus metrics, and an **OpenAI booking assistant** — `apps/dashboard`, a React/Redux
> SPA on a custom Webpack build with a live availability calendar, and `apps/marketplace`,
> a **Next.js 16** SSR/PWA storefront (discover, profile, booking) with an Arabic **RTL**
> locale and GPU-only animations. The mobile app lands in a later phase.

```bash
# prerequisites: Node 22+, npm, Docker (for Postgres)
npm install                                   # also generates the Prisma client
npm run lint && npm run typecheck && npm test && npm run build   # full verification

# run the API:
cp services/api/.env.example services/api/.env   # set DATABASE_URL; never commit .env
docker compose up -d db                          # local PostgreSQL
npm run db:deploy -w @ermulaku/api               # apply migrations
npm run db:seed   -w @ermulaku/api               # sample data
npm run start:dev -w @ermulaku/api               # API + Swagger at :4000/docs
```

See [`services/api/README.md`](./services/api/README.md) for the full API guide.

| Service            | Local URL                     |
| ------------------ | ----------------------------- |
| Marketplace        | http://localhost:3000         |
| Dashboard          | http://localhost:3100         |
| API (REST/Swagger) | http://localhost:4000/docs    |
| GraphQL            | http://localhost:4000/graphql |
| gRPC               | localhost:50051               |

## Scripts

```bash
npm run dev          # start apps/services in watch mode
npm run build        # build all packages
npm run lint         # eslint + prettier
npm run typecheck    # tsc --noEmit across workspaces
npm test             # unit tests (Jest)
npm run e2e          # Cypress
npm run storybook    # component catalog
```

## Built with AI

This repo is built with an **AI-augmented workflow** (Claude Code) under senior review — AI handles
mechanical work; architecture, correctness, and security stay human-owned. The approach,
verification checklist, and security process live in [`AGENTS.md`](./AGENTS.md), and the per-phase
prompts are recorded in [`SPEC.md` §17](./SPEC.md) as evidence.

## Documentation

- [`SPEC.md`](./SPEC.md) — full build spec & phases
- [`AGENTS.md`](./AGENTS.md) — AI-augmented workflow & verification process
- [`docs/API.md`](./docs/API.md) — REST / GraphQL / gRPC reference
- [`docs/schema.graphql`](./docs/schema.graphql) — generated GraphQL SDL
- [`proto/booking.proto`](./proto/booking.proto) — gRPC contract
- [`docs/adr/`](./docs/adr) — architecture decision records

## Testing & CI

Every domain rule has a Jest test; core flows have Cypress E2E. GitHub Actions runs
lint → typecheck → test → build on every PR, plus a Lighthouse CI budget on the marketplace.

## Operations

The API exposes a liveness probe `GET /health`, a DB-checked readiness probe `GET /ready`,
Prometheus metrics at `GET /metrics` (process metrics + request rate/latency), and a small
self-contained status page at `GET /status`. See [`docs/operations.md`](./docs/operations.md)
for how I'd own uptime in production (probes, alerts, SLOs, dashboards).

## AI booking assistant

`POST /assistant/chat` is an OpenAI function-calling assistant: the model picks among
`searchTutors` / `getAvailability` / `bookLesson` and **the server executes** each via the same
service layer (validation server-side; the key never leaves the server). Set `OPENAI_API_KEY` to
enable it — unset, the endpoint returns `503`. Tests mock the model, so CI needs no key.

## Roadmap

- [x] **Phase 1** — Monorepo + `slot-engine` (tested) + CI + `AGENTS.md`
- [x] **Phase 2** — NestJS API + Prisma/Postgres + REST + Swagger
- [x] **Phase 3** — GraphQL + gRPC + API docs
- [x] **Phase 4** — Dashboard SPA (custom Webpack) + real-time
- [x] **Phase 5** — Marketplace (SSR/PWA, RTL, GPU animations) + UI/Storybook + Cypress
- [x] **Phase 6** — AI booking assistant + monitoring
- [ ] **Phase 7** — Elixir notifications + Expo mobile + publish slot-engine to npm

## License

MIT © Ermir Mulaku
