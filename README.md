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

> Status: 🚧 in active development — see [Roadmap](#roadmap).
> Live demo: _TODO_ · API docs: _TODO_ · Storybook: _TODO_

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
| Path | What |
|---|---|
| `apps/marketplace` | Next.js student app (SSR, PWA, RTL, GPU-only animations) |
| `apps/dashboard` | React + Redux tutor dashboard (custom Webpack) |
| `apps/mobile` | Expo / React Native student app |
| `services/api` | NestJS — REST + GraphQL + gRPC over Postgres |
| `services/notifications` | Elixir/Phoenix — lesson reminders |
| `packages/slot-engine` | timezone-aware availability engine ([published to npm](#)) |
| `packages/ui` | shared component library + Storybook |
| `packages/types`, `packages/api-client` | shared TS types & typed client |

## Getting started
```bash
# prerequisites: Node 20+, npm, Docker (for Postgres), and (optional) Elixir
npm install
cp .env.example .env            # fill values; never commit .env
docker compose up -d db         # local PostgreSQL
npm run db:migrate              # Prisma migrate + seed
npm run dev                     # run apps/services (see package scripts)
```
| Service | Local URL |
|---|---|
| Marketplace | http://localhost:3000 |
| Dashboard | http://localhost:3100 |
| API (REST/Swagger) | http://localhost:4000/docs |
| GraphQL | http://localhost:4000/graphql |
| gRPC | localhost:50051 |

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
Health: `GET /health` (liveness), `GET /ready` (readiness). Metrics: Prometheus at `/metrics`.
Status page: _TODO_. See [`docs/operations.md`](./docs/operations.md) for uptime/SLO notes.

## Roadmap
- [ ] **Phase 1** — Monorepo + `slot-engine` (tested) + CI + `AGENTS.md`
- [ ] **Phase 2** — NestJS API + Prisma/Postgres + REST + Swagger
- [ ] **Phase 3** — GraphQL + gRPC + API docs
- [ ] **Phase 4** — Dashboard SPA (custom Webpack) + real-time
- [ ] **Phase 5** — Marketplace (SSR/PWA, RTL, GPU animations) + UI/Storybook + Cypress
- [ ] **Phase 6** — AI booking assistant + monitoring
- [ ] **Phase 7** — Elixir notifications + Expo mobile + publish slot-engine to npm

## License
MIT © Ermir Mulaku
