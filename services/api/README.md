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

## AI Gateway + RAG

A small, central AI gateway (`src/ai-gateway/`) with auth/RBAC, rate limits,
cost tracking, caching, model fallback, and audit logging — fronting a RAG
help-center assistant and a tutor-only conversation summarizer. Modeled on a
production AWS Bedrock gateway (see the mapping table below).

### Request flow

```
PrincipalGuard (401)
  → per-task allowedKinds check (403)
    → RateLimitService.checkRequestRate (429 + Retry-After)
      → validate task input (400)
        → AiCacheService lookup (cached: true → skip everything below)
          → RateLimitService.checkTokenBudget (429)
            → ModelRouterService.run/runStream → BedrockLlmClient
              → RateLimitService.addTokenUsage + AiCacheService.set
                → UsageLogService.record + MetricsService.observeAiRequest
```

`help_question` additionally retrieves help-article chunks before the model
call (`RetrieverService` → S3 Vectors); a too-distant match answers _"I
couldn't find this in the help center"_ without calling the LLM at all.

### Production mapping

| TutorHub (built)                       | Production equivalent            |
| -------------------------------------- | -------------------------------- |
| App Runner (built-in LB + autoscaling) | ALB + ECS Fargate                |
| `PrincipalGuard` on the existing JWT   | SSO / Cognito JWT verification   |
| Task registry in code                  | RBAC tables in RDS Postgres      |
| Redis in Docker                        | ElastiCache Redis                |
| Prisma `AiUsageLog` (Postgres)         | DynamoDB / S3 usage + audit logs |
| Prometheus metrics                     | CloudWatch metrics + alarms      |
| Bedrock + S3 Vectors                   | same                             |

### Endpoints

| Method & path          | Purpose                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `GET /ai/tasks`        | Tasks the caller's principal kind (student/tutor) may use                              |
| `POST /ai/chat`        | Run a task; returns `{task, answer, model, usage, cached, sources?}`                   |
| `POST /ai/chat/stream` | Same, as SSE: `data:{"token":...}` then `data:{"done":true,"usage":...,"sources":...}` |

Both `/ai/chat*` require a Bearer JWT (student or tutor — `POST
/auth/dev-login` / `POST /auth/tutor/dev-login`) and return an `x-request-id`
header tying the call to its `AiUsageLog` row.

### Env vars

See [`.env.example`](.env.example) for the full list with comments:
`REDIS_URL`, `AWS_REGION`, `BEDROCK_PRIMARY_MODEL_ID`,
`BEDROCK_FALLBACK_MODEL_ID`, `BEDROCK_EMBED_MODEL_ID`, `S3_VECTOR_BUCKET`,
`S3_VECTOR_INDEX`, `RAG_MAX_DISTANCE`, `AI_RATE_LIMIT_PER_MIN`,
`AI_DAILY_TOKEN_BUDGET`, `AI_MODEL_PRICES_JSON`.

### RAG: ingest + eval

```bash
npm run rag:ingest   # chunk + embed + write the 12 help articles to S3 Vectors
npm run rag:eval     # 10 questions (expected article) + 2 out-of-scope — hit@4, calibrates RAG_MAX_DISTANCE
```

Both boot a minimal Nest context (no Redis/Postgres needed) and are safe to
re-run — `rag:ingest` overwrites by key (`articleId#chunkIndex`) rather than
duplicating.

### Try it

```bash
TOKEN=$(curl -s -X POST localhost:4000/auth/dev-login -H 'Content-Type: application/json' \
  -d '{"email":"sara@example.com"}' | jq -r .accessToken)

curl -s localhost:4000/ai/tasks -H "Authorization: Bearer $TOKEN"

curl -s -X POST localhost:4000/ai/chat -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"task":"help_question","input":{"question":"Can I cancel 2 hours before my lesson?"}}'

curl -N -X POST localhost:4000/ai/chat/stream -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"task":"help_question","input":{"question":"How do gift cards work?"}}'
```

### Known limitations

- `help_question`'s RAG only covers the 12 seeded help articles — anything
  else correctly falls back to "I couldn't find this in the help center."
- No streaming retry: once a model has sent a token, a mid-stream failure
  ends the response rather than failing over (non-streaming `/ai/chat` does
  retry + fall back).
- Token-budget check-before/add-after can slightly overshoot the daily cap
  under concurrent requests (documented as acceptable in `token-budget.ts`).
- Cost tracking (`AI_MODEL_PRICES_JSON`) is as accurate as the prices you
  configure; an unlisted model id prices at `$0` with a logged warning.
- `GET /metrics` and `AiUsageLog` are unauthenticated/un-aggregated — fine for
  a single-instance dev deployment, not a multi-tenant one.

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
npm run rag:ingest  # AI gateway: embed + index the help-center articles
npm run rag:eval    # AI gateway: retrieval quality eval (hit@4)
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
