<!--
  Copy this into the repo root as AGENTS.md.
  This file is a GRADED artifact: it demonstrates the "AI-augmented workflow" requirement.
  Keep it living — update it as you build. Be specific and honest.
-->

# AI-Augmented Workflow

This project is built with an **AI-augmented engineering workflow**: AI agents (Claude Code,
Cursor, GitHub Copilot) handle the mechanical work so I can move faster, while I stay fully
accountable — as a senior engineer — for the architecture, correctness, and security of every
line that ships. AI is a **force multiplier for delivery**, not an unreviewed code source.

This file documents how I work with AI and, crucially, **how I verify what it produces.**

## Principles

1. **I own the output.** Anything an agent generates is my responsibility. If I can't explain it, it doesn't merge.
2. **Plan first, generate second.** I define the architecture, contracts, and acceptance criteria (see `SPEC.md`) before any agent writes code.
3. **Small, reviewable steps.** Agents work in tight, scoped tasks tied to a single phase/PR — never "build the whole app."
4. **Verification is non-negotiable.** Generated code passes typecheck, lint, and tests, and a manual review, before commit.
5. **Security stays human-owned.** Auth, validation, secrets, and data handling are reviewed by me regardless of who drafted them.

## How I use agents

- **Scaffolding & boilerplate** — project setup, config, repetitive CRUD, test skeletons.
- **Implementation from a spec** — I hand the agent the relevant `SPEC.md` section; it drafts; I review and refine.
- **Refactoring & tests** — generating edge-case tests (e.g. the slot-engine timezone cases), then I verify they actually assert the right behavior.
- **Docs** — first drafts of READMEs / API docs, which I correct for accuracy.

## Verification checklist (run before every commit)

- [ ] `npm run typecheck` passes (no `any` introduced)
- [ ] `npm run lint` passes
- [ ] `npm test` passes; new logic has tests I reviewed (not just generated)
- [ ] I read every changed line and can explain it
- [ ] No secrets, keys, or real card/PII data committed
- [ ] Input validated; authz checked on new endpoints/resolvers/RPCs
- [ ] Dependencies are necessary, reputable, and licence-compatible
- [ ] Behavior verified manually (ran it), not just "looks right"

## Security review for generated code

- Validate and type all external input (`class-validator` / GraphQL inputs / proto messages).
- Authn (JWT) + authz (roles) enforced server-side; never trust the client.
- Secrets only in env; `.env` is gitignored; `.env.example` documents required vars.
- The AI booking assistant: the model may _decide_ actions but **the server executes** them with
  the same auth/validation as any other request. The OpenAI key stays server-side.

## What I do NOT delegate

- Architecture and API contract decisions.
- Security-sensitive logic (auth, payments, data access boundaries).
- Final review and the decision to merge.

## Tooling

- **Claude Code** — multi-file implementation from spec, refactors, tests.
- **Cursor / Copilot** — inline completions and quick edits.
- Each phase started from one scoped build prompt; what was built and **how it was verified** is
  recorded per phase in the Phase log below for traceability.

## Commit & PR convention

- Commits follow Conventional Commits with a single imperative, capitalised subject ≤ 50 chars
  (enforced by commitlint); PRs note where AI assisted and what I changed/verified.
- Example PR line: _"Scaffolded resolvers with Claude from SPEC §9; rewrote the availability
  resolver to use slot-engine, added 6 timezone tests, verified DST boundaries manually."_

## Phase log

### Phase 1 — Foundation ✅

**Built (in small, reviewed commits):** an Nx + npm-workspaces monorepo with a strict shared
`tsconfig.base.json`; the ESLint (flat, `no-explicit-any: error`) / Prettier / Husky + lint-staged /
commitlint toolchain; `packages/types` (shared domain model, SPEC §8); and the flagship
`packages/slot-engine` — a zero-runtime-dependency, timezone/DST-aware `getAvailableSlots`
(buffer, lead time, breaks, overlaps, midnight crossing, injected deterministic `now`) built on the
runtime's `Intl` rather than a date library. A GitHub Actions workflow runs lint → typecheck → test
→ build on Node 22.

**Verified (not just generated):**

- `npx nx run-many -t lint typecheck test build` green across both packages; **42** slot-engine
  tests pass, including DST spring-forward (lost hour ⇒ fewer slots) and fall-back (gained hour ⇒
  more slots) with exact UTC-instant assertions I checked by hand against known CET/CEST offsets.
- Ran `npm ci` and the built ESM output as a smoke test to confirm real behaviour, not "looks right".
- **Security/deps:** `npm audit` driven to **0 vulnerabilities** by pinning patched transitive
  versions via `overrides` (`form-data`, `tmp`, and a scoped `js-yaml` for Jest's coverage tooling),
  each reviewed to confirm the override was API-compatible rather than a blind bump.

### Phase 2 — API core ✅

**Built (in six reviewed commits):** `services/api`, a NestJS 11 **ESM** service over
**PostgreSQL + Prisma 7**. A Prisma schema modelling SPEC §8 (with a seed of 3 tutors, subjects
and a student); a global `PrismaModule` using the Prisma 7 **driver-adapter** pattern; REST CRUD
for tutors/subjects/bookings with `class-validator` DTOs and **Swagger** at `/docs`; and a shared
`BookingService` whose status **state machine** is the single source of truth (reused by GraphQL/
gRPC later). Domain errors map to HTTP via a global filter (404/409/400).

**Verified (not just generated):**

- Exhaustive unit tests for the status machine (all 25 from→to pairs) run **without a database**;
  **9 supertest e2e tests** exercise the real REST API against Postgres (create → confirm →
  complete, plus 409/404/400 paths).
- CI gained a **Postgres service container** + `prisma migrate deploy` so endpoints are verified on
  every push; the unit suite stays DB-free.
- Manually drove the booking lifecycle over HTTP and read Swagger to confirm behaviour.
- **Adapting to Prisma 7** (a new major) was done against current docs, not memory: the datasource
  URL moved to `prisma.config.ts` and runtime connects via `@prisma/adapter-pg`.
- `npm audit` kept at **0 vulnerabilities** (added `multer` and `@hono/node-server` overrides for
  NestJS/Prisma-CLI transitive advisories).

### Phase 3 — GraphQL + gRPC ✅

**Built (in six reviewed commits):** a code-first **Apollo GraphQL** API
(`autoSchemaFile` → committed `docs/schema.graphql`) with object/input types, enums, pagination,
nested resolvers, a built-in `DateTime` scalar, and an `availability` query that calls
`@ermulaku/slot-engine`; **minimal JWT auth** (dev-login + GraphQL guard + `@CurrentUser`) for
`me`/`myBookings`/mutations; **typed GraphQL errors** (`NOT_FOUND` / `BAD_USER_INPUT`) via a
context-aware exception filter; and a **gRPC** microservice from `proto/booking.proto`
(`tutorhub.v1`) reusing `BookingService`, with `Timestamp`↔`Date` mapping, gRPC status codes, and a
server-streaming `WatchBookings` backed by an in-process RxJS event bus. All three protocols share
one service layer. Full reference in `docs/API.md`.

**Verified (not just generated):**

- **21 e2e tests** across two suites: REST + GraphQL (auth, availability, mutations, the
  cross-transport book→complete→review flow) and a real **gRPC client** suite (unary calls, the
  `NOT_FOUND` / `FAILED_PRECONDITION` mappings, and a live `WatchBookings` stream assertion).
- A test caught a real behaviour I'd have missed: availability for a _past_ date returns `[]`
  (the engine filters slots before `now`) — so the test queries a computed future Monday instead.
- Adopted current library facts over memory: `graphql` pinned to **16** (Apollo/Nest don't support
  17 yet), and Express 5 needs the `@as-integrations/express5` Apollo integration.
- `npm audit` kept at **0 vulnerabilities** (added a `ws` override for a GraphQL-subscriptions
  transitive advisory).

### Phase 4 — Dashboard SPA ✅

**Built (in seven reviewed commits):** a Socket.IO **gateway** on the API (fed by the Phase 3 RxJS
`BookingEvents` bus, fanning changes out to per-tutor rooms); and `apps/dashboard`, a React 19 +
Redux Toolkit SPA on a **hand-written Webpack 5** build (TS via ts-loader, SVGR, CSS extraction,
code-splitting, env injection, bundle analyzer). Data flows through **RTK Query** over REST; the SPA
has a week **availability calendar** (set working hours, see bookings in the tutor's timezone),
**booking management** (legal status transitions only), and **live updates** via a Socket.IO hook
that invalidates the booking cache.

**Verified (not just generated):**

- Drove the whole UI **in a real browser** (Preview tool): the dropdown loads tutors, the calendar
  shades working hours and shows a booking chip, saving Saturday **persisted to the DB** and the grid
  refetched, and an **external** API status change pushed to the dashboard **live** (~300ms, no
  interaction) and recoloured the chip — proving the Socket.IO path end-to-end.
- Added a **gateway e2e** (real socket.io-client receives `bookingChanged`) and **dashboard Jest/RTL
  tests** (reducer, calendar helpers, a `WeekCalendar` render); whole-workspace `nx test` green.
- **Build-tooling judgement:** Babel 8's `preset-typescript` mis-parsed generic call expressions, so
  I switched the Webpack TS transform to `ts-loader` (type-checking stays a separate `tsc` target).
- `npm audit` kept at **0 vulnerabilities** (dev-server-only `http-proxy-middleware` / `uuid`
  overrides, each checked for API compatibility — e.g. confirming `uuid@11` keeps a CJS export).

### Phase 5 — Marketplace ✅

**Built (in eight reviewed commits):** `packages/ui`, a focused, **RTL-safe** (CSS logical
properties only) and **GPU-only-animated** (`transform`/`opacity` + `will-change`) React primitive
set documented in **Storybook** (LTR/RTL + light/dark toolbar); and `apps/marketplace`, a
**Next.js 16** App Router SSR storefront. It has a dependency-free **i18n** layer with
locale-prefixed routes (`/en`, `/ar`) and `Accept-Language` negotiation in `proxy.ts`; Arabic renders
fully mirrored. Pages are React Server Components fetching from the GraphQL API through a tiny typed
`fetch` client: a **discover** grid (URL-driven search + level filters), a **profile** page (detail +
availability shown in the tutor's timezone), and a **booking flow** whose slots open a GPU-animated
booking sheet and confirm via a **Server Action** (dev-login + `bookLesson`, token kept server-side).
Plus a hand-written **PWA** (manifest, service worker, zero-dep PNG icon generator), a **Cypress**
search→book E2E, and a **Lighthouse CI** budget.

**Verified (not just generated):**

- Drove every page **in a real browser** (Preview tool) in both locales: discover search filtered
  the grid live (URL + count updated), the profile showed slots converted into the tutor's timezone,
  and a booking went end-to-end — a `PENDING` row persisted and availability dropped **8 → 7** as the
  slot-engine excluded the booked time. Arabic mirrored correctly throughout.
- **Cypress** search→book passes headlessly; **Lighthouse** (desktop, prod build) clears the budget:
  performance **0.96/1.0**, accessibility **0.95**, best-practices/SEO **1.0**.
- Caught a real **API bug** the storefront was first to hit: the `tutors` resolver forwarded GraphQL
  `null` filter variables into Prisma and crashed; fixed `findPage` to guard `!= null` and use a
  case-insensitive `contains` search, with an e2e regression test (api e2e **22 → 23**).
- Adopted current library facts: **Next.js 16** (not the spec-era 15) with its `proxy.ts` convention
  (migrated off deprecated `middleware.ts` per the official codemod docs); consumed the workspace
  packages' built `dist` because Next's bundler can't resolve their NodeNext `.js` specifiers.
- `npm audit` kept at **0 vulnerabilities** — a Next-bundled `postcss < 8.5.10` (XSS advisory) was
  pinned via a same-minor root override (clean reinstall to apply).

### Phase 6 — AI + monitoring ✅

**Built (in three reviewed commits):** **monitoring** for the API — a hand-written Prometheus layer
(`/metrics` via `prom-client`: default process metrics + an `http_requests_total` counter and
`http_request_duration_seconds` histogram fed by a global request middleware that also emits
structured JSON access logs), a DB-checked readiness probe (`/ready`) beside the existing liveness
`/health`, and a self-contained `/status` page that polls both. And the **OpenAI booking assistant**
(SPEC §12B): `POST /assistant/chat` runs an OpenAI function-calling loop where the model chooses
among `searchTutors` / `getAvailability` / `bookLesson` and **the server executes** each through the
existing service layer (same validation as any other request). The OpenAI key stays server-side; the
endpoint returns `503` when unconfigured.

**Verified (not just generated):**

- **Live, with a real key:** one chat ("find a maths tutor and book Monday") drove the model through
  all three tools in order and persisted a real `PENDING` booking (Ben Carter / Mathematics) — proving
  the model decides and the server executes.
- **Mocked in CI:** the assistant e2e overrides the OpenAI seam with a scripted client (no key, no
  network) and asserts the tool-call → server-execution → booking path, plus the `503`-when-unconfigured
  case; a `ToolDispatcher` unit test covers arg parsing and error mapping. Monitoring has unit
  (`normalizeRoute`) + e2e (`/ready`, `/metrics`, `/status`) coverage. API e2e **23 → 28**.
- **Security-reviewed the generated AI code by hand:** the model never executes anything itself — it
  only returns tool names + JSON args, which the dispatcher validates and routes to typed services;
  booking is scoped to a resolved student id; the key is read from env and never logged or returned.
- A dedicated `marketplace-e2e` CI job runs Cypress + Lighthouse; the main job's `nx run-many` builds
  and tests every project including the new modules. `npm audit` stayed at **0 vulnerabilities**.

### Phase 7 — Bonus ✅

**Built (in five reviewed commits):** the cross-stack bonus surface. `packages/api-client` — a small,
isomorphic typed client (GraphQL reads + booking, REST dev-login) reusing `@ermulaku/types`;
`apps/mobile` — an **Expo / React Native** student app (SDK 56) that lists tutors, shows availability
in the tutor's timezone, and books a lesson through `api-client`; `services/notifications` — an
**Elixir / Phoenix** service (the one non-TS service) that turns booking events into lesson reminders
via a `GenServer` store + a periodic scheduler, delivery mocked; and **`@ermulaku/slot-engine`
published to npm** (metadata, `prepublishOnly`, LICENSE, badges).

**Verified (not just generated):**

- **`slot-engine` is live on npm** (`@ermulaku/slot-engine@0.1.0`), verified with `npm publish
--dry-run` before the real publish (run by the maintainer; publishing is an irreversible public act).
- **The mobile app books a lesson** — driven in a real browser via the Expo **web** export: tapped a
  tutor → real availability in their timezone → tapped a slot → confirmation, and the booking
  **persisted** (verified in Postgres). Also `expo export` proves the monorepo bundles through Metro.
- **The notifications service** has **7 ExUnit tests** (scheduling one hour out, idempotent delivery,
  the webhook) and a live `POST /api/bookings → 202` check; CI gained an Elixir job (setup-beam,
  `mix format --check`, compile `--warnings-as-errors`, `mix test`).
- `api-client` is unit-tested against a mocked `fetch`. Whole-workspace `nx run-many` stayed green and
  `npm audit` at **0 vulnerabilities** throughout.
- **Adapted to the environment honestly:** Elixir/Erlang weren't installed, so I installed the
  toolchain to actually compile and test the service rather than ship it unverified.

### Phase 8 — Tutor dashboard ✅

Recreating the `design_handoff_tutor_dashboard` handoff as the real tutor-facing app in
`apps/dashboard`: 11 modules + onboarding, full real backend, tutor auth, and the
`@ermulaku/ui` design system (light/dark + Teal/Indigo/Plum accents). Built in scoped sub-phases.

**8.0 Foundation ✅** — **Built:** tutor authentication folded into the (previously
student-only) JWT via a backward-compatible `kind` claim — `AuthService.sign(sub, kind)`, a
strict `TutorAuthGuard` + `@CurrentTutor` writing to `req.tutor` (never `req.user`), tutor
`email`/`passwordHash` columns (nullable migration), `tutorSignin`/`tutorDevLogin`
(GraphQL + REST), `meTutor`, and a seeded persona tutor ("Lena Hartmann"). The student
`JwtAuthGuard` stays permissive (legacy/marketplace/mobile tokens unaffected) but rejects
tutor tokens. Frontend: adopted `@ermulaku/ui` tokens in the dashboard via additive
unprefixed aliases + `[data-accent]` Teal/Indigo/Plum palettes (overriding the `--th-primary`
ramp so the primitives follow the accent; marketplace never sets `data-accent`, so it's
unaffected); a React-Router shell (Sidebar/Topbar), theme/accent/online/auth Redux state
(OS-default theme, `localStorage`-persisted), an auth-aware RTK Query base query that speaks
both REST and GraphQL and clears the session on 401, a tutor `LoginScreen`, and stubbed
routes for all 11 modules.

**Verified (not just generated):** drove the whole flow **in a real browser** (Preview tool)
— signed in as the seed tutor, the shell rendered with the tutor's name resolved via
`meTutor`, the theme toggle flipped light/dark, the accent switcher recoloured both the
dashboard and the UI primitives (button/avatar) to plum, navigation changed routes, and
theme/accent/session **persisted across reload**. **6 tutor-auth e2e tests** assert
dev-login/signin, `meTutor`, and the cross-token rejection both ways; the existing
student-auth suite stays green. Whole-workspace `nx run-many -t lint typecheck test build`
green across 8 projects; `npm audit` **0 vulnerabilities**.

**8.1 Dashboard + Calendar + Lessons ✅** — **Built:** the first three tutor-scoped modules.
Backend: tutor wrappers on the shared `BookingService` (`acceptForTutor`/`declineForTutor`/
`completeForTutor`, each asserting `booking.tutorId === tutorId` before going through the same
state machine + `BookingEvents`), a `TutorDashboardModule` with `dashboardSummary` (KPI
aggregates), `todaySchedule`, and `tutorBookings(status?, from?, to?)`, plus a timezone-day
helper (`startOfDayInZone`/`startOfWeekInZone`, `Intl`-based, injectable `now`). The seed gained
the persona's roster + bookings across every status (today/upcoming/pending/past + reviews).
Frontend: real Dashboard (KPI row, today's schedule, "Up next" gradient card, quick actions),
Calendar (CSS-grid week view, events positioned by start/duration), and Lessons (Upcoming/
Pending/Past tabs with accept/decline/complete + toasts); a `ToastProvider`, `SegmentedTabs`,
`KPIStat`, `StatusPill`; and a live pending badge in the sidebar fed by `dashboardSummary`.

**Verified (not just generated):** **in a real browser** — KPIs matched the seed (3 lessons
today, $165 this week, 4.7★/3 reviews, 2 pending), accepting a request fired a toast and dropped
both the segmented-tab and sidebar badges 2→1 (mutation → DB → cache invalidation → refetch),
and an **external** accept via curl pushed through Socket.IO and cleared the pending badge/row
**with no interaction** — proving the live path end-to-end. **4 tutor-dashboard e2e tests**
(KPIs, tutor-scoped `tutorBookings`, accept transition, cross-tutor accept rejected) + a
zoned-dates unit test; whole-workspace `nx run-many` green across 8 projects, `npm audit` **0**.

**8.2 Catalog + Availability ✅** — **Built:** a `Service` model (1:1/Group/Package, per-service
price/duration/lessons) + `TimeOff` (migration), a `CatalogModule` (`myServices`,
`createService`/`updateService`/`setServiceActive`/`deleteService`, all owner-scoped), and
availability self-service on the existing `AvailabilityModule` (`myAvailability`,
`updateWorkingHours`/`updateBookingRules`/`addTimeOff`/`removeTimeOff`) — the booking-rule
columns added in 8.0 now drive real settings. Seed gained Lena's four services + a time-off
range. Frontend: a Catalog grid of service cards (type pills, live/hidden, price) with a
create-service `Modal`, and an Availability screen with per-day iOS `ToggleSwitch` + time
ranges, booking-rule inputs, and a time-off list/add — plus a reusable `ToggleSwitch`.

**Verified (not just generated):** **in a real browser** — the catalog rendered all four seeded
services with the right type pills and live/hidden state, the availability screen showed Mon–Fri
hours + the seeded "🏖 Summer break", and **Save rules** round-tripped with a toast. **3 e2e
tests** (owner-scoped `myServices`, cross-tutor delete rejected, working-hours/rules round-trip);
`nx run-many` green across 8 projects, `npm audit` **0**. (Caught a real gotcha: a dev token is
invalidated by a reseed because it regenerates the tutor id — re-login fixes it.)

**8.3 Messaging (real-time) ✅** — **Built:** `Conversation` + `Message` models + `SenderKind`
(migration), and a `MessagingModule` mirroring the booking real-time pattern exactly — a
`MessageEvents` RxJS bus and a `MessagingGateway` that fans `sendMessage` out to per-tutor and
per-conversation Socket.IO rooms (`messageReceived`). `MessagingService` gives owner-scoped
`conversations` (with preview + unread count), `messages`, `sendMessage`, `markConversationRead`,
and `unreadCount` — now feeding the dashboard's `unreadMessages` KPI/sidebar badge. Seed gained
three threads with unread student messages. Frontend: a two-pane `ChatPane` (thread list + bubble
conversation + composer) and a `use-live-messages` hook beside `use-live-bookings`.

**Verified (not just generated):** **in a real browser** — the thread list showed unread badges
(Tom 1, Mia 2) and the sidebar Messages badge read 3; opening a thread marked it read; and a
message sent from **another device** (curl) appeared **live in the open conversation with no
interaction**. **3 e2e tests** (unread count, `markRead` clears it, and a real `socket.io-client`
receiving `messageReceived`); `nx run-many` green across 8 projects, `npm audit` **0**.

**8.4 Earnings + Payouts ✅** — **Built:** a `Payout` model + `Payment` fields (`feeCents`,
denormalised `tutorId`, `payoutId`) + `Tutor.payoutMethod` (migration); an `EarningsModule` with
`earningsSummary` (available = PAID & un-paid-out net, pending = PENDING net, lifetime = all PAID
net), `earningsByMonth` (8-month buckets from booking dates), `transactions`, and `withdraw`
(sweeps available into a new `Payout`) / `setPayoutSchedule` / `setPayoutMethod`. Seed generates
~40 historical completed bookings with payments across 8 months (older ones grouped into a paid-out
payout, recent ones available, one PENDING). Frontend: a gradient `BalanceCard` with Withdraw, a
reusable `BarChart`, a payout-method card, and a transactions table with CSV export.

**Verified (not just generated):** **in a real browser** — figures matched the seed (available
$374, pending $47, lifetime $2,104), the 8-month chart rendered with the current month highlighted,
and **Withdraw swept available to $0 with a toast**. **3 e2e tests** (net summary math, 8 monthly
buckets, withdraw zeroes available while lifetime holds); `nx run-many` green across 8 projects,
`npm audit` **0**.

**8.5 Marketing ✅** — **Built:** `Promotion` + `Referral` models + `GiftCard.tutorId`
(migration); a `MarketingModule` with `marketingSummary` (active promos, total redemptions, gift
cards sold), `promotions`, `referralProgram` (created on first read), `createPromotion`, and
`endPromotion` (owner-scoped). Seed gained three promotions (Active/Scheduled/Ended), a referral
record, and gift cards sold under Lena. Frontend: a Marketing screen with stat cards, a promotions
grid (`PromoCard` with state pills + a copy-to-clipboard `CodeChip`), and gift-card + referral
cards, plus a create-promotion modal.

**Verified (not just generated):** **in a real browser** — stat cards matched the seed (1 active,
46 redemptions, $145 sold), promotions showed the right state pills, and the code chip copied with
a toast. **3 e2e tests** (create→summary counts active, cross-tutor end rejected, referral
auto-created); `nx run-many` green across 8 projects, `npm audit` **0**.

**8.6 Reviews + Analytics + Settings + Onboarding ✅** — **Built:** `Review.reply`/`repliedAt`
(migration) and four modules — **Reviews** (`reviewSummary` avg + 5★ distribution, `myReviews`
filterable all/unreplied/replied, `replyToReview`), **Analytics** (`analyticsSummary` —
lessons-this-month, new students, repeat rate, slot-capacity utilization — plus `lessonsOverTime`,
`topSubjects`, `lessonsByDayOfWeek`, `studentMix`, all aggregated in-service from completed
bookings), **Settings** (`tutorSettings`, `updateTutorProfile`, `updateTutorNotificationPrefs`),
and **Onboarding** (`publishProfile` flips `isActive`). Frontend: Reviews (summary + distribution
bars + filter tabs + inline reply), Analytics (an SVG `AreaChart`, top-subject bars, day-of-week
`BarChart`, student-mix split bar), Settings (Profile / Payout / Notifications tabs), and a 6-step
`OnboardingWizard` overlay.

**Verified (not just generated):** **in a real browser** — reviewing replied to a review (toast +
"You replied" block), analytics rendered every chart from the seed (8 lessons this month, 100%
repeat, Maths/Physics split), settings saved profile + toggled notifications, and the onboarding
wizard stepped to "You're all set, Lena!" and **published → redirected to the dashboard**. **4 new
e2e tests**; the **whole API e2e suite is green (11 suites / 54 tests)** — no regressions in
student auth or the earlier phases — and `nx run-many` passes across 8 projects with `npm audit`
**0**.

**Phase 8 outcome:** all 11 desktop modules + onboarding ship against a real, tutor-scoped backend
(tutor auth, messaging, payouts, promotions, review replies, analytics, settings) on the
`@ermulaku/ui` design system with light/dark + Teal/Indigo/Plum theming.

**8.8 New-lesson flow + notifications feed ✅** — Wired the two substantive topbar placeholders.
Backend: `BookingService.createForTutor` (a tutor books a **CONFIRMED** lesson, validating the
subject is theirs), plus `myStudents` / `mySubjects` pickers and a synthesized `tutorNotifications`
feed (pending booking requests + unread message threads + recent reviews, newest-first). Frontend:
a `NewLessonModal` (student/subject/datetime → `createLesson`) opened from the "New lesson" button
and mounted shell-wide, and a `NotificationsBell` dropdown on the topbar bell (dot when non-empty,
closes on outside click); the feed refreshes live off the booking/message Socket.IO events.

**Verified (not just generated):** **in a real browser** — the bell showed 7 items (messages,
reviews, booking requests) with type dots + relative times; the New-lesson modal booked Sofia ·
Mathematics · 15 Jul, which **persisted as CONFIRMED** (checked via the API). **4 e2e tests**
(`createLesson` confirmed, cross-tutor subject rejected, `myStudents`, booking request surfaces in
notifications); `nx run-many` green across 8 projects, `npm audit` **0**. (Still placeholders by
intent: topbar search and the calendar Day/Month toggle.)

**8.7 Responsive + completeness pass ✅** — Made the dashboard fully responsive: a slide-in
sidebar **drawer** (hamburger + backdrop, closes on navigation) below 1024px, two-column layouts
collapsing at 900px, a phone layout at 640px (stacked KPIs, trimmed topbar, stacked chat,
horizontally-scrolling calendar/tables, panel-less onboarding). Verified in-browser at 375 / 768 / 1440. Filled the remaining design-flow gaps: **calendar week navigation** (Today / ‹ / ›),
the dashboard **setup banner** (dismissible → onboarding) and **Latest review** card. `nx run-many`
green across 8 projects, `npm audit` **0**. (Cosmetic-only controls left as placeholders by intent:
topbar search, "New lesson", the notifications bell, and the calendar Day/Month view toggle.)

---

_This workflow is the point, not a footnote: ship faster with AI, and take senior accountability
for quality and security._
