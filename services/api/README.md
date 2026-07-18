# @ermulaku/api

The TutorHub API — a **NestJS 11 (ESM)** service over **PostgreSQL + Prisma 7**.
It exposes the same domain over **three protocols** sharing one service layer
(`BookingService` is the single source of truth for booking rules):

- **REST** + Swagger UI at `/docs`
- **GraphQL** (code-first Apollo) at `/graphql` — SDL committed to [`docs/schema.graphql`](../../docs/schema.graphql)
- **gRPC** (`tutorhub.v1`) from [`proto/booking.proto`](../../proto/booking.proto), default `localhost:50051`

Full reference: [`docs/API.md`](../../docs/API.md). Guarded GraphQL operations
use a JWT — mint one via `POST /auth/dev-login`.

## Prerequisites

- Node 22+
- Docker (for local Postgres), or any reachable PostgreSQL

## Setup

```bash
cp .env.example .env            # set DATABASE_URL (and PORT)
docker compose up -d db         # local Postgres on :5432 (from the repo root)
npm run db:deploy -w @ermulaku/api   # apply migrations
npm run db:seed   -w @ermulaku/api   # 3 tutors, subjects, 1 student
```

The Prisma client is generated automatically on `npm install` (the package's
`postinstall` runs `prisma generate`) into `src/generated/prisma` (gitignored).

## Run

```bash
npm run start:dev -w @ermulaku/api   # watch mode (tsx)
# or
npm run build -w @ermulaku/api && npm run start -w @ermulaku/api
```

- API: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/docs` · OpenAPI JSON: `/docs-json`

## REST endpoints

| Method & path                                                           | Purpose                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| `GET /health`                                                           | Liveness probe                                      |
| `GET /ready`                                                            | Readiness probe (checks the database)               |
| `GET /metrics`                                                          | Prometheus metrics (process + request rate/latency) |
| `GET /status`                                                           | Self-contained HTML status page                     |
| `POST/GET /tutors`, `GET/PATCH/DELETE /tutors/:id`                      | Tutor CRUD                                          |
| `POST/GET /subjects` (`?tutorId`), `GET/PATCH/DELETE /subjects/:id`     | Subject CRUD                                        |
| `POST/GET /bookings` (`?status,tutorId,studentId`), `GET /bookings/:id` | Booking create/list/get                             |
| `PATCH /bookings/:id/status`                                            | Status change (enforces the state machine)          |
| `POST /auth/dev-login`, `POST /auth/tutor/dev-login`                    | Mint a student / tutor JWT by email (dev)           |
| `POST /assistant/chat`                                                  | OpenAI booking assistant (JWT + rate-limited)       |
| `POST /stripe/webhook`                                                  | Stripe payment/Connect webhook                      |

Input is validated with `class-validator`; domain errors map to HTTP via a
global filter (`404` not found, `409` illegal transition, `400` validation).

Most of the app surface — including the Phase-8 tutor-dashboard modules
(**catalog, availability, messaging, earnings, marketing, reviews, analytics,
tutor-settings, account, wallet, favorites, payments**) and student/tutor auth —
is exposed over **GraphQL**, not REST. See [`docs/schema.graphql`](../../docs/schema.graphql)
and [`docs/API.md`](../../docs/API.md) for the full contract.

### Booking lifecycle

```
PENDING ─▶ CONFIRMED ─▶ COMPLETED
   │           │
   └─▶ CANCELLED   └─▶ NO_SHOW
```

`COMPLETED` / `CANCELLED` / `NO_SHOW` are terminal. The rules live in
[`booking-status.ts`](src/bookings/booking-status.ts) — the single source of
truth reused by every transport.

## Scripts

```bash
npm run build       # tsc → dist (ESM)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src test
npm test            # unit tests (status machine; no DB)
npm run test:e2e    # e2e tests (supertest; needs Postgres)
npm run db:migrate  # prisma migrate dev (create + apply a migration)
npm run db:deploy   # prisma migrate deploy (apply committed migrations)
npm run db:seed     # seed sample data
```

## Notes on Prisma 7

- The datasource URL lives in [`prisma.config.ts`](prisma.config.ts), not the
  schema; runtime connections use the `@prisma/adapter-pg` driver adapter.
- The generated client uses the ESM `prisma-client` generator.

## Configuration & deployment

Config is env-driven (see [`.env.example`](.env.example)): `DATABASE_URL`,
`JWT_SECRET`, `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`) for the booking
assistant — unset and `/assistant/chat` returns `503` — Stripe keys, and
`GRPC_ENABLED=false` where only one port is available.

In production the API runs as a Docker container on **AWS App Runner** (image in
ECR), shipped by `.github/workflows/deploy-api.yml`. Secrets come from AWS Secrets
Manager. Full runbook: [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).
