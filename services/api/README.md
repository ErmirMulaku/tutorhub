# @ermulaku/api

The TutorHub API — a **NestJS 11 (ESM)** service over **PostgreSQL + Prisma 7**.
Phase 2 exposes the domain over **REST** with **Swagger** docs and a shared
`BookingService` that enforces the booking status state machine. GraphQL and
gRPC (sharing the same service layer) arrive in Phase 3.

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

| Method & path                                                           | Purpose                                    |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| `GET /health`                                                           | Liveness probe                             |
| `POST/GET /tutors`, `GET/PATCH/DELETE /tutors/:id`                      | Tutor CRUD                                 |
| `POST/GET /subjects` (`?tutorId`), `GET/PATCH/DELETE /subjects/:id`     | Subject CRUD                               |
| `POST/GET /bookings` (`?status,tutorId,studentId`), `GET /bookings/:id` | Booking create/list/get                    |
| `PATCH /bookings/:id/status`                                            | Status change (enforces the state machine) |

Input is validated with `class-validator`; domain errors map to HTTP via a
global filter (`404` not found, `409` illegal transition, `400` validation).

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
