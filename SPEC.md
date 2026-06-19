# TutorHub — Build Spec (Claude Code ready)

A production-grade **tutoring/lessons marketplace** (the Fresha pattern, in education) built as a
TypeScript monorepo. Engineered to satisfy **both** target roles:

- **Senior Frontend Engineer** (React/Redux SPA, AI-augmented workflow, toolchain, perf, tests, DB, full-stack, Elixir bonus)
- **Senior Full Stack Engineer, TypeScript** (React/Next frontend, **GraphQL + gRPC** API design & docs, monitoring/uptime, RTL, GPU-only animations, build tooling)

> Rename `TutorHub` if you like. Original brand/UI — not a clone of any existing tutoring site.

---

## 0. How Claude Code should use this spec

- Build **phase by phase** (Section 16). Do not start a phase until the previous one is green
  (lint + typecheck + tests + build all pass in CI).
- After each phase: update the root `README.md`, commit with a clear message, and tick the
  acceptance criteria.
- **AI-augmented workflow is a graded requirement.** Maintain `AGENTS.md` (Section 12) from
  commit #1, write descriptive commit/PR messages, and never commit code you haven't reviewed,
  typed, and tested. Treat every generated file as needing senior review.
- Conventions in Section 7 are mandatory across all packages.
- Keep secrets in `.env` (never commit). Provide `.env.example` in every app/service.

---

## 1. Goal & principle

One **finished, documented, tested, CI'd** monorepo that mirrors Fresha's *shape* (consumer
marketplace + provider dashboard + booking/payments backend + native app) in the tutoring
domain. Ship each phase before starting the next — a finished phase beats a half-built feature.

## 2. Requirements coverage (point-by-point)

| Requirement | Role | Where it's built |
|---|---|---|
| Complex React + Redux SPA | both | `apps/dashboard` (custom Webpack) |
| React / Next.js web frontend | full-stack | `apps/marketplace` (SSR) |
| GraphQL API design + docs | full-stack | `services/api` GraphQL layer |
| gRPC API design + docs | full-stack | `services/api` gRPC + `proto/` |
| Efficient, documented, multi-consumer APIs | full-stack | REST + GraphQL + gRPC + `docs/API.md`, Swagger, SDL |
| Monitoring / uptime | full-stack | `/health`, `/ready`, Prometheus metrics, status page |
| GPU-only CSS animations | full-stack | marketplace UI (transform/opacity only) |
| RTL ("a plus") | both | i18n with an RTL locale + logical CSS |
| Build tooling (Webpack, esbuild, TS) | both | custom Webpack SPA, esbuild, TS monorepo |
| AI-augmented workflow | frontend | `AGENTS.md` + verified AI delivery (+ AI booking assistant) |
| Lerna / monorepo | frontend | Nx or Lerna + npm workspaces |
| SSR / PWA / RAIL / Core Web Vitals | frontend | marketplace + Lighthouse CI |
| Jest / Cypress / CI | frontend | unit + E2E + GitHub Actions |
| Database schema design | frontend | PostgreSQL + Prisma |
| Full-stack Node | frontend | NestJS API |
| High-standard documentation | both | READMEs, ADRs, API docs, Storybook |
| Maintainable, reusable code | frontend | `packages/ui` + Storybook + published npm package |
| Native Android/iOS | frontend | `apps/mobile` (Expo/React Native) |
| Ruby/Elixir (double bonus) | frontend | `services/notifications` (Elixir/Phoenix) |
| Published npm package | frontend (toolchain/docs) | `packages/slot-engine` → npm |

Soft skills (communication, autonomy, fast-paced) are shown in the interview, supported by clean
docs and commit history.

## 3. Domain model

Tutoring marketplace. Entities:
```
Tutor      — a provider: bio, subjects, hourly rate, working hours, timezone
Subject    — what can be taught (e.g. Guitar, Math), with level
Student    — a consumer who books
Booking    — a Student reserving a Tutor for a time slot; has status
Review     — a Student's rating/comment on a completed Booking
Payment    — charge tied to a Booking (mocked provider; no real card data)
```
`Booking.status: PENDING → CONFIRMED → COMPLETED ↘ CANCELLED / NO_SHOW`.
Resolved relations: `Booking.tutor`, `Booking.student`, `Booking.subject`, `Tutor.subjects`,
`Tutor.reviews`.

## 4. Architecture

```
        STUDENTS                                  TUTORS
           │                                         │
  ┌────────▼─────────┐                     ┌─────────▼──────────┐
  │  apps/marketplace │                     │   apps/dashboard   │
  │  Next.js SSR/PWA  │                     │ React+Redux (Webpack)│
  │  apps/mobile (Expo)│                    └─────────┬──────────┘
  └────────┬──────────┘                               │
           │        GraphQL / REST                    │
           └───────────────────┬──────────────────────┘
                               ▼
                   ┌────────────────────────┐
                   │  services/api (NestJS) │  shared service layer
                   │  REST · GraphQL · gRPC │  (one source of truth)
                   └─────┬───────────┬──────┘
                  gRPC   │           │
        ┌───────────────▼──┐    ┌────▼─────────┐
        │ services/         │    │  PostgreSQL  │
        │ notifications     │    │  (Prisma)    │
        │ (Elixir/Phoenix)  │    └──────────────┘
        └───────────────────┘
Real-time: WebSocket events from API → dashboard (live bookings).
```

## 5. Tech stack & key decisions

TypeScript everywhere · React 19 + Redux Toolkit · Next.js 15 (SSR + PWA) · custom **Webpack 5**
+ **esbuild** · NestJS 11 · **GraphQL** (Apollo, code-first) + **gRPC** (`@grpc/grpc-js`) ·
**PostgreSQL + Prisma** · Socket.IO (real-time) · i18n + **RTL** · OpenAI (AI features) ·
Elixir/Phoenix (notifications) · Expo/React Native (mobile, **no Cordova**) · Jest + Cypress ·
GitHub Actions + Lighthouse CI · Storybook.

Decisions:
- **PostgreSQL over MySQL** — richer relational features, first-class with Prisma/NestJS, matches
  Fresha's likely stack (Elixir → Postgres).
- **Mobile = Expo/React Native only** (no Cordova) — covers native Android/iOS; explain the choice
  in interview.
- **Payments are mocked** — a fake payment provider; never handle real card data.

## 6. Monorepo layout
```
tutorhub/
├── apps/
│   ├── marketplace/     # Next.js 15 — student SSR/PWA app (React + Redux Toolkit)
│   ├── dashboard/       # React + Redux SPA, custom Webpack (tutor back office)
│   └── mobile/          # Expo / React Native — student app
├── services/
│   ├── api/             # NestJS — REST + GraphQL + gRPC over Postgres/Prisma
│   └── notifications/   # Elixir/Phoenix — lesson reminders (bonus)
├── packages/
│   ├── slot-engine/     # timezone-aware availability engine → PUBLISHED TO NPM
│   ├── ui/              # shared component library + Storybook
│   ├── types/           # shared TypeScript types
│   └── api-client/      # typed client (REST + GraphQL)
├── proto/               # gRPC contracts (.proto)
├── docs/                # ADRs, API.md, schema.graphql, architecture.md
├── .github/workflows/   # CI: lint, typecheck, test, build, Lighthouse
├── AGENTS.md            # AI-augmented workflow record (graded requirement)
└── README.md
```

## 7. Conventions (mandatory)
- **Tooling:** npm workspaces + **Nx** (or Lerna) for task running/caching. ESLint + Prettier +
  Husky pre-commit (lint-staged). Conventional Commits.
- **TypeScript:** `strict` mode on. No `any` in committed code. Shared types live in `packages/types`.
- **Testing:** every domain rule has a Jest test; critical user flows have a Cypress test. CI must be green to merge.
- **Docs:** every package has a README; key decisions go in `docs/adr/NNN-title.md`; APIs in `docs/API.md`.
- **AI workflow:** record approach + verification in `AGENTS.md`; reference AI usage in PR descriptions.
- **Security:** validate all input (`class-validator`), authn via JWT, authz via roles, never log secrets, never commit `.env`.

## 8. Data model (Prisma sketch)
```prisma
model Tutor {
  id           String    @id @default(uuid())
  name         String
  bio          String?
  timezone     String                       // e.g. "Europe/Belgrade"
  hourlyCents  Int
  workingHours Json                          // [{ day:1, start:"09:00", end:"17:00" }]
  isActive     Boolean   @default(true)
  subjects     Subject[]
  bookings     Booking[]
  reviews      Review[]
  createdAt    DateTime  @default(now())
}
model Subject {
  id     String @id @default(uuid())
  name   String
  level  Level
  tutor  Tutor  @relation(fields:[tutorId], references:[id])
  tutorId String
}
model Student {
  id        String    @id @default(uuid())
  fullName  String
  email     String    @unique
  bookings  Booking[]
  createdAt DateTime  @default(now())
}
model Booking {
  id         String        @id @default(uuid())
  tutor      Tutor         @relation(fields:[tutorId], references:[id])
  tutorId    String
  student    Student       @relation(fields:[studentId], references:[id])
  studentId  String
  subjectId  String
  startTime  DateTime
  endTime    DateTime
  status     BookingStatus @default(PENDING)
  payment    Payment?
  review     Review?
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
}
model Review  { id String @id @default(uuid()) bookingId String @unique rating Int comment String? tutorId String }
model Payment { id String @id @default(uuid()) bookingId String @unique amountCents Int status PaymentStatus }
enum Level         { BEGINNER INTERMEDIATE ADVANCED }
enum BookingStatus { PENDING CONFIRMED COMPLETED CANCELLED NO_SHOW }
enum PaymentStatus { PENDING PAID REFUNDED }
```
Enforce status transitions in a shared `BookingService` (one source of truth for REST/GraphQL/gRPC).

## 9. API layer — REST + GraphQL + gRPC (full-stack role centerpiece)

`services/api` exposes the same domain over three protocols sharing one service layer.

### REST + Swagger
Baseline CRUD for tutors/subjects/bookings, documented via `@nestjs/swagger` at `/docs`.

### GraphQL (code-first Apollo, `autoSchemaFile` → `docs/schema.graphql`)
```graphql
type Tutor { id: ID! name: String! bio: String hourlyCents: Int! timezone: String!
  subjects: [Subject!]! rating: Float reviews: [Review!]! }
type Subject { id: ID! name: String! level: Level! }
enum Level { BEGINNER INTERMEDIATE ADVANCED }
enum BookingStatus { PENDING CONFIRMED COMPLETED CANCELLED NO_SHOW }
type Booking { id: ID! tutor: Tutor! subject: Subject! student: Student!
  startTime: DateTime! endTime: DateTime! status: BookingStatus! }
type TutorPage { items: [Tutor!]! total: Int! hasMore: Boolean! }
type Slot { start: DateTime! end: DateTime! }
input BookInput { tutorId: ID! subjectId: ID! startTime: DateTime! }
type Query {
  tutors(subject: String, level: Level, limit: Int = 20, offset: Int = 0): TutorPage!
  tutor(id: ID!): Tutor
  availability(tutorId: ID!, date: String!): [Slot!]!     # uses packages/slot-engine
  myBookings(status: BookingStatus): [Booking!]!
}
type Mutation {
  bookLesson(input: BookInput!): Booking!
  cancelBooking(id: ID!, reason: String): Booking!
  leaveReview(bookingId: ID!, rating: Int!, comment: String): Review!
}
```
Covers: object/input/enum types, nested resolvers, pagination, `DateTime` scalar, typed errors
(`NOT_FOUND`, `BAD_USER_INPUT`), JWT guard.

### gRPC — `proto/booking.proto`, package `tutorhub.v1`
```proto
syntax = "proto3";
package tutorhub.v1;
import "google/protobuf/timestamp.proto";
service BookingService {
  rpc GetBooking      (GetReq)    returns (Booking);
  rpc BookLesson      (BookReq)   returns (Booking);
  rpc UpdateStatus    (UpdateReq) returns (Booking);
  rpc WatchBookings   (WatchReq)  returns (stream Booking); // server-streaming
}
enum BookingStatus { BOOKING_STATUS_UNSPECIFIED=0; PENDING=1; CONFIRMED=2; COMPLETED=3; CANCELLED=4; NO_SHOW=5; }
message Booking { string id=1; string tutor_id=2; string student_id=3; string subject_id=4;
  google.protobuf.Timestamp start_time=5; BookingStatus status=6; }
message GetReq    { string id=1; }
message BookReq   { string tutor_id=1; string student_id=2; string subject_id=3; google.protobuf.Timestamp start_time=4; }
message UpdateReq { string id=1; BookingStatus status=2; }
message WatchReq  { string tutor_id=1; }
```
Covers: proto3 messages, enums (`_UNSPECIFIED=0`), `Timestamp`, unary + **server-streaming**
(`WatchBookings`, backed by Socket.IO events via RxJS), versioned package, status-code mapping
(`NOT_FOUND`, `INVALID_ARGUMENT`, `FAILED_PRECONDITION`).

### API docs (graded)
`docs/API.md` documents every REST route, GraphQL operation, and gRPC RPC: purpose, example
request, example response, error codes. Commit `docs/schema.graphql`; keep `proto/*.proto`
commented.

## 10. Frontend

### `apps/marketplace` — Next.js (SSR + PWA)
SSR pages: discover/search, tutor profile, booking flow, student bookings. PWA (installable,
offline shell). **RTL**: English (LTR) + one RTL locale (e.g. Arabic) with `dir` + CSS logical
properties (`margin-inline-start`, etc.). **GPU-only animations**: build all motion with
**`transform` + `opacity` only** (+ `will-change`) — booking sheet slide-up, modal fade, tutor
card hover, route transitions, skeleton shimmer. Track Core Web Vitals; enforce a Lighthouse CI budget.

### `apps/dashboard` — React + Redux SPA, custom Webpack
The complex SPA: a **week/day availability calendar** (set working hours, see bookings), booking
management, subject/profile management, and earnings. Configure **Webpack 5 from scratch**
(code-splitting, env injection, SVGR, bundle analyzer) to prove build-tooling skill.

### `packages/ui` + Storybook
Reusable, documented components (button, form fields, calendar primitives, slot picker). Each has
a Storybook story covering its states. This is the documented design system.

## 11. `packages/slot-engine` — the npm package (publish)
Pure, framework-agnostic, **zero-dependency** TypeScript. One job: compute bookable slots.
```ts
getAvailableSlots({
  workingHours,        // [{ day, start, end }]
  existingBookings,    // [{ start, end }]
  slotMinutes,         // e.g. 60
  date,                // target day
  options              // { timezone, bufferMinutes, leadMinutes }
}): Slot[]
```
Senior bar: correct **timezone/DST** handling, buffer/lead time, breaks, overlapping bookings,
slots crossing midnight. Deterministic (inject "now"), fully unit-tested. Ship TS types, a clear
README with examples, semver. Publish as `@<yourname>/slot-engine` (optionally auto-publish on a
version tag via GitHub Actions). The API's `availability` query consumes it — one artifact, two wins.

## 12. AI-augmented workflow (graded) + AI feature

### A. Workflow (primary — this is the requirement)
Build the repo **with AI agents (Claude/Cursor/Copilot)** and make it visible & accountable:
- **`AGENTS.md`**: your approach (how you split work into agent tasks), and your **verification &
  security process** for generated code (typecheck, tests, lint, review checklist, dependency/security checks).
- PR/commit messages note AI-assisted work + what you reviewed/changed.
- A README "Built with AI" section. Keep the phase prompts (Section 17) in the repo as evidence.

### B. AI feature (secondary, demoable) — OpenAI booking assistant
A chat assistant using **OpenAI function calling**: tools `searchTutors`, `getAvailability`,
`bookLesson` map to real API calls. Model decides which tool to call; **your code executes** it
(auth/validation stay server-side). Optional: embeddings-based semantic tutor search (ties to your
eduwo FAISS experience). Keep the OpenAI key server-side; never expose it to the client.

## 13. Monitoring & uptime (full-stack role)
- `/health` (liveness) + `/ready` (readiness, checks DB) endpoints.
- Structured logging + request metrics; **Prometheus** metrics endpoint.
- A small **status page** (in dashboard) or a Grafana dashboard. README "Operations" section
  explains how you'd own uptime in production (alerts, SLOs).

## 14. Deployment (Google Cloud)
- **API (NestJS)** → **Cloud Run** (containerized, autoscaling).
- **Database** → **Cloud SQL for PostgreSQL** via the Cloud SQL connector.
- **Marketplace** → Vercel or Cloud Run; **mobile** → Expo (EAS) build.
- **notifications (Elixir)** → second Cloud Run service.
- **URLs:** ship on free URLs first (`*.run.app`, `*.vercel.app`). **Optional:** later buy one
  domain and use subdomains (`api.`, `app.`, `docs.`) — not required, do it only when demo-ready.

## 15. Testing & CI
- **Jest** (unit: slot-engine, services, resolvers, reducers) + **Cypress** (E2E: search → book).
- **GitHub Actions**: lint → typecheck → test → build on every PR; **Lighthouse CI** budget on
  marketplace. Branch protection; PR template referencing AI usage + verification.

## 16. Phased milestones (ship each before the next)

| Phase | Deliverable | Acceptance criteria |
|---|---|---|
| **1 — Foundation** | Monorepo (Nx/Lerna), `packages/types`, **`packages/slot-engine`** with full tests, ESLint/Prettier/Husky, CI skeleton, `AGENTS.md` started | slot-engine 100% of edge cases tested; CI green; `npm test` passes |
| **2 — API core** | `services/api` NestJS + Prisma/Postgres schema + REST CRUD + Swagger + shared `BookingService` (status rules) + seed data | REST endpoints work; Swagger at `/docs`; status-transition tests pass |
| **3 — GraphQL + gRPC** | Add GraphQL (Section 9) + gRPC (`proto/booking.proto`) reusing the service layer; `availability` uses slot-engine; `docs/API.md` + `docs/schema.graphql` | GraphQL + gRPC return correct data; `WatchBookings` streams; docs committed |
| **4 — Dashboard SPA** | `apps/dashboard` React+Redux + custom Webpack: calendar, availability, booking management; live updates via WebSocket | tutor can set hours + see bookings live; Webpack build + analyzer work |
| **5 — Marketplace** | `apps/marketplace` Next.js SSR/PWA: discover, profile, booking flow; **RTL locale**; **GPU-only animations**; `packages/ui` + Storybook; Cypress E2E; Lighthouse CI | book-a-lesson E2E passes; RTL renders mirrored; Lighthouse budget met |
| **6 — AI + monitoring** | OpenAI booking assistant (function calling); `/health` `/ready` + Prometheus + status page; finalize `AGENTS.md` | assistant books via tools; health/metrics live |
| **7 — Bonus** | `services/notifications` (Elixir/Phoenix) reminders; `apps/mobile` (Expo) student app; **publish slot-engine to npm** | reminder sends on booking; mobile books a lesson; package live on npm |

Phases 1–5 already make you credible for both roles; 6–7 complete the AI/monitoring/Elixir/mobile/npm coverage.

## 17. Ordered Claude Code prompts (run inside `tutorhub/`)
1. *"Scaffold an Nx TypeScript monorepo with npm workspaces. Create packages/types and packages/slot-engine. Implement getAvailableSlots per SPEC §11 (timezone/DST, buffer, lead time, breaks, overlaps, deterministic 'now'); write exhaustive Jest tests. Add ESLint, Prettier, Husky, and a GitHub Actions CI that lints, typechecks, tests, and builds. Start AGENTS.md documenting the AI workflow and verification process."*
2. *"Create services/api (NestJS 11). Model the domain with Prisma + Postgres per SPEC §8. Build REST CRUD with Swagger and a shared BookingService that enforces status transitions. Seed 3 tutors, subjects, and a student."*
3. *"Add a code-first GraphQL API (Apollo, autoSchemaFile→docs/schema.graphql) and a gRPC microservice from proto/booking.proto per SPEC §9, both reusing BookingService. Implement nested resolvers, pagination, typed errors; unary RPCs + WatchBookings streaming backed by Socket.IO via RxJS; map errors to gRPC status codes. The availability query must use packages/slot-engine. Write docs/API.md."*
4. *"Build apps/dashboard: a React + Redux Toolkit SPA with a custom Webpack 5 config (code-splitting, SVGR, bundle analyzer). Implement a week/day availability calendar, booking management, and live booking updates via WebSocket."*
5. *"Build apps/marketplace in Next.js 15: SSR discover/profile/booking-flow pages, PWA config, an RTL locale using dir + CSS logical properties, and GPU-only animations (transform/opacity, will-change) for the booking sheet, modals, hover, and route transitions. Build packages/ui components with Storybook. Add Cypress E2E for search→book and a Lighthouse CI budget."*
6. *"Add the OpenAI booking assistant per SPEC §12B (function calling: searchTutors, getAvailability, bookLesson; execution stays server-side). Add /health, /ready, Prometheus metrics, and a status page. Finalize AGENTS.md."*
7. *"Add services/notifications in Elixir/Phoenix sending lesson reminders from booking events. Build apps/mobile (Expo/React Native) student app reusing packages/types and api-client. Prepare packages/slot-engine for npm (README, semver, types) and publish."*

## 18. CV impact
Replace the small side-project entries with one flagship (keep S2O):
> **TutorHub — Tutoring Marketplace (open-source)** · TS monorepo · React/Redux · Next.js · NestJS ·
> GraphQL · gRPC · PostgreSQL · Expo · Elixir
> - Built a production-grade booking marketplace as an Nx monorepo: a Next.js SSR/PWA student app, a
>   custom-Webpack React/Redux tutor dashboard, and an Expo mobile app over a NestJS API exposing the
>   same domain via **REST, GraphQL, and gRPC** with full documentation.
> - Engineered a timezone-aware availability engine **published to npm**, GPU-only CSS animations, an
>   RTL locale, an OpenAI booking assistant built with an AI-augmented workflow, monitoring/health
>   metrics, and Jest/Cypress + GitHub Actions CI; deployed on Google Cloud Run + Cloud SQL.

After shipping, move **GraphQL, gRPC, Lerna/monorepo, Elixir, Cypress, monitoring, npm-published
package** from "familiar" to proven — all backed by one public repo you can demo end to end.

## 19. Guardrails
✅ Original brand/UI · finished phases over big unfinished repos · document everything · real tests + CI · mocked payments.
🚫 Don't clone any real tutoring site's brand · don't match Fresha's scale · don't leave half-built apps in `main` · never commit secrets or real card data.
