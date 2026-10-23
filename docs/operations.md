# Operations

How TutorHub is observed today, and how I'd own its uptime in production.

## Endpoints

| Endpoint       | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `GET /health`  | **Liveness** — process is up. Cheap, no dependencies. Probe target.     |
| `GET /ready`   | **Readiness** — runs `SELECT 1`; `503` if the database is unreachable.  |
| `GET /metrics` | **Prometheus** exposition: default process metrics + HTTP rate/latency. |
| `GET /status`  | A small self-contained page polling `/health` and `/ready` every 5s.    |

### Metrics

`prom-client` exposes Node/process defaults (CPU, heap, event-loop lag) plus two app metrics, fed by
a global request middleware that also emits a structured JSON access log per request:

- `http_requests_total{method,route,status}` — counter.
- `http_request_duration_seconds{method,route,status}` — histogram.

Routes are normalized (`/tutors/:id`, not raw ids) to keep label cardinality bounded; `/metrics`
itself is excluded so scrapes don't inflate the counters.

## Owning uptime in production

This repo wires the signals; here's how I'd operate them.

- **Probes.** Point the orchestrator's liveness probe at `/health` and the readiness probe at
  `/ready`, so a pod with a dead DB connection is pulled from rotation instead of serving errors.
- **Scraping & dashboards.** Prometheus scrapes `/metrics`; a Grafana board tracks request rate,
  error ratio (`status=~"5.."`), and p50/p95/p99 latency from the histogram, plus event-loop lag and
  heap as saturation signals.
- **SLOs & alerts.** Target **99.9%** availability and **p95 < 300ms** on read paths. Alert on a
  fast+slow burn of the error-rate SLO (multi-window) and on readiness failing across replicas —
  alerting on symptoms (user-facing errors/latency), not just host metrics.
- **Logs & tracing.** Access logs are structured JSON for ingestion; the next step is request-id
  propagation and OpenTelemetry traces across REST/GraphQL/gRPC and the booking path.
- **Runbook.** `/ready` red → check DB connectivity/credentials and connection-pool saturation;
  latency alert → inspect the slowest routes on the dashboard and recent deploys; roll back on
  regression. The mocked-in-CI AI assistant and help chat both degrade to `503` if every model in
  the Bedrock chain fails, so an LLM outage never takes down core booking.

## Connection pool math

Each API instance has its own pool of Postgres connections (Prisma's pg adapter → node-postgres
`Pool`). Its size is `DATABASE_POOL_SIZE` (default **10**), set in `PrismaService`.

**The rule:** `max instances × pool size + everything else < Postgres max_connections`.
"Everything else" = migrations, the backfill script, `psql` sessions, monitoring, and Postgres's
own `superuser_reserved_connections` (3).

App Runner autoscales instances (25 at most by default), so plan for the **maximum**, not today's
count:

| Postgres                                                 | max_connections | Room for the API      | Pool size if we allow 25 instances |
| -------------------------------------------------------- | --------------- | --------------------- | ---------------------------------- |
| Local Docker (`postgres:17`)                             | 100             | ~85 (leave ~15 spare) | 3 — fine for 1–2 local processes   |
| RDS `db.t4g.medium` (4 GiB) — formula `memory / 9531392` | ~410            | ~380                  | 15                                 |
| RDS `db.r6g.large` (16 GiB)                              | ~1,800          | ~1,700                | 60 (but see below)                 |

Bigger isn't better: each Postgres connection is a process using memory, and past roughly
2–4 × CPU cores of _active_ queries, throughput drops. When instances × pool gets large, put
**PgBouncer in transaction mode** (or RDS Proxy, or Neon's `-pooler` endpoint) in front. The app
then keeps small pools, and PgBouncer multiplexes them onto a few real connections.

What transaction pooling means for this code:

- `pg_advisory_xact_lock` (Block 2) is **transaction**-scoped, so it's safe. A session-level
  `pg_advisory_lock` would not be (the next transaction may run on another server connection).
- `SET lock_timeout` in a migration is session state, so **run migrations on a direct
  connection**, not through PgBouncer. `CREATE INDEX CONCURRENTLY` also needs one.
- Interactive transactions hold a real connection from `BEGIN` to `COMMIT`. Keep them short.

**A hot slot can empty the pool.** Booking a slot takes a transaction plus the tutor's advisory
lock (Block 2). Twenty people booking the same slot at once → twenty transactions, each holding a
connection while it **waits in line** for the lock. With a pool of 10, the rest wait for a
connection; after Prisma's 2 s `maxWait` they fail with `P2028`. Seen in the e2e suite while
another request was loading 200k tutors at once (the discover-page bug, since fixed): one slow
query anywhere makes every lock queue longer. Mitigations, cheapest first: a bigger pool on the booking path; a short
`lock_timeout` on the advisory lock that answers "slot is busy, try again"; or rate-limit a single
slot (most of those 20 will get `SLOT_UNAVAILABLE` anyway).

Watch: `pg_stat_activity` count by state (`active`, `idle`, `idle in transaction`), Prisma `P2028`
errors, and p99 latency of `POST /graphql` `bookLesson`. A growing count of `idle in transaction`
means something holds transactions open.

## Zero-downtime schema changes (expand → backfill → contract)

Worked example: `Booking.source` (Block 6). Measured on 2,045,000 bookings in `tutorhub_load`,
with a second process writing to `Booking` every 50 ms.

1. **Expand** (`booking_source_expand` migration): add the column **nullable**, with
   `SET lock_timeout = '3s'`. Old app versions keep working; new code writes it on every insert.
2. **Backfill** (`DATABASE_URL=… npx tsx scripts/backfill-booking-source.ts` in `services/api`): batches of 10k by primary key,
   200 ms apart, resumable. 2,045,000 rows in 523 s. Writes meanwhile: p50 16.6 ms, worst 514 ms,
   never blocked. Run it once more after every instance writes `source`, to catch rows old
   versions inserted behind the cursor.
3. **Contract** — a **separate, later PR**, after step 2 has run in production. (If it shipped
   together with step 1, the deploy would run `VALIDATE` before the backfill, fail, and leave the
   migration half-applied — Prisma `P3018`.) Each statement goes in its own migration file:

   ```sql
   SET lock_timeout = '3s';
   ALTER TABLE "Booking" ADD CONSTRAINT booking_source_not_null CHECK (source IS NOT NULL) NOT VALID; -- 13 ms
   ALTER TABLE "Booking" VALIDATE CONSTRAINT booking_source_not_null;   -- 1,019 ms, writes keep going
   ALTER TABLE "Booking" ALTER COLUMN source SET NOT NULL;              -- 2 ms: trusts the valid CHECK (PG 12+)
   ALTER TABLE "Booking" DROP CONSTRAINT booking_source_not_null;       -- 6 ms
   ```

   Compare a plain `ALTER COLUMN source SET NOT NULL`: 2,005 ms scanning under an exclusive lock,
   and **a write was blocked for 1,968 ms**. At 200M rows that's minutes of frozen bookings.

Rules learned the hard way (all reproduced in this repo):

- **`lock_timeout` on every DDL migration.** Seen live: an `ALTER TABLE` queued behind slow
  writes, every write behind the ALTER waited up to 13.5 s, and after 3 s `lock_timeout`
  cancelled it (`55P03`) and freed the table.
- **Prisma 7.8 applies a migration file statement by statement under `migrate deploy`, but
  `migrate dev` wraps a multi-statement file in one transaction.** So: one `CONCURRENTLY` statement
  per file. And a failed deploy can be **half-applied** (`P3018`): undo the partial change,
  `prisma migrate resolve --rolled-back <name>`, fix, and deploy again.
- **`CREATE INDEX CONCURRENTLY`** for new indexes: on 2M rows the build ran inside a 14 s deploy
  while writes continued (p50 5.7 ms, worst 141 ms). If it fails it leaves an `INVALID` index:
  drop it and retry.
- **Never edit a migration after it's applied** — even comments change its checksum, and
  `migrate dev` then offers to reset the database.
- A full-table backfill writes a new version of every row: the table grew 456 → 549 MB here.
  Autovacuum reuses the space, but doesn't give it back to the OS (`pg_repack` does, online).

## Rollout playbook (feature flags)

Risky booking changes ship **dark**: the code is deployed with its feature flag off, then turned
on gradually with `scripts/flag.ts`. Deploying (moving code) and releasing (turning it on) are
separate steps, so rolling back a release is a flag flip, not a redeploy.

| Flag                | Turns on                               | Subject    | No row means         |
| ------------------- | -------------------------------------- | ---------- | -------------------- |
| `booking.v2_result` | suggested free slots in `bookLessonV2` | student id | **off**              |
| `outbox.publish`    | the outbox relay publishing to Kafka   | `relay`    | **on** (kill switch) |

How a flag decides: `enabled = false` → off for everyone. Otherwise it's on for the
`allowList`, plus the students whose stable bucket `sha256(flag:subject) % 100` is below
`rolloutPercent`. Raising 10% → 25% keeps the first 10% on, so nobody flips back and forth. Each
API instance caches a flag for **30 s**, so every change (including turning something off) takes
up to 30 s to reach all instances.

### Before turning it on

1. **Write the rollback rule down first**, in the PR or the release ticket. Deciding after things
   go wrong invites "let's wait a bit longer". Default rule: roll back if, for 10 minutes compared
   with the hour before:
   - booking error rate (`booking_create_duration_seconds_count{outcome="error"}` /
     all outcomes) is more than **2×** baseline, or above 1%;
   - p95 of `booking_create_duration_seconds` is **50%** above baseline;
   - `booking_conflicts_total{reason="concurrent_change"}` rate jumps (a new race);
   - `outbox_pending` keeps growing, or consumer lag (`rpk group describe notifications`) keeps
     growing.
2. Note the baseline for each of those (Grafana screenshot or the numbers).
3. Deploy with the flag **off** and confirm nothing moved: a dark deploy must be a no-op.

### Turning it on

```bash
cd services/api
npx tsx scripts/flag.ts set booking.v2_result --on --allow <your-test-student-id>   # internal first
npx tsx scripts/flag.ts set booking.v2_result --percent 5     # then 5% → 25% → 50% → 100%
npx tsx scripts/flag.ts list
```

Wait at least 30 s (cache) plus one full watch window (10 min) at each step, and compare against
the baseline. Watch the new path's own signals too. For `booking.v2_result`: p95 of
`bookLessonV2`, since suggestions run the slot engine for up to 7 days. (A metric for how often students
pick a suggested slot would show whether the feature helps; it doesn't exist yet.)

### Rolling back

```bash
npx tsx scripts/flag.ts set booking.v2_result --off            # everyone back on the old path within 30 s
npx tsx scripts/flag.ts set outbox.publish --off               # stop Kafka publishing; events wait in OutboxEvent
```

No deploy, no migration. Then work out why at leisure. After a kill switch, `outbox_pending`
grows while it's off and drains when it's back on (`--on`). Consumers are idempotent, so nothing
is lost or doubled.

### After 100%

Once a flag has been at 100% for a while with no rollback, **delete the flag and the old code
path** in a normal PR. Every flag doubles the paths to test, and stale flags are how "turn off
the old thing" incidents happen.
