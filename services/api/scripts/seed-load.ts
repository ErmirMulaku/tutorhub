/**
 * Fill a SEPARATE local database with production-sized data for query
 * performance work (docs/FRESHA_DEPTH_SPEC.md Block 6, docs/QUERY_PERFORMANCE.md).
 *
 *   ~20k tutors · ~200k students · ~2M bookings over 2 years
 *   + one "heavy" student with 25k bookings (to compare page 1 vs page 1,000)
 *   + one busy tutor with 20k bookings (real data is skewed: a few huge accounts)
 *
 * Everything is generated inside Postgres with `generate_series` — one
 * INSERT … SELECT per chunk, not 2 million round trips from Node.
 *
 * Safety: it never reads .env. It connects to LOAD_DATABASE_URL (default: the
 * local `tutorhub_load`) and refuses to run unless the database it reached is
 * literally named `tutorhub_load`.
 *
 *   docker compose exec db psql -U tutorhub -c 'CREATE DATABASE tutorhub_load'
 *   DATABASE_URL=…/tutorhub_load npx prisma migrate deploy
 *   npm run db:seed-load
 */
import pg from 'pg';

const url =
  process.env['LOAD_DATABASE_URL'] ?? 'postgresql://tutorhub:tutorhub@localhost:5432/tutorhub_load';
const TUTORS = 20_000;
const STUDENTS = 200_000;
const BOOKINGS_PER_TUTOR = 100;
const TUTORS_PER_CHUNK = 2_000; // 200k bookings per INSERT
const HEAVY_STUDENT_BOOKINGS = 25_000;
const BUSY_TUTOR_BOOKINGS = 20_000;
const BUSY_TUTOR_STUDENTS = 5_000;

const client = new pg.Client({ connectionString: url });

async function step(label: string, sql: string, params: unknown[] = []): Promise<void> {
  const started = Date.now();
  const result = await client.query(sql, params);
  console.log(
    `${label}: ${result.rowCount ?? 0} rows in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

async function main(): Promise<void> {
  await client.connect();
  const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
  if (rows[0]?.db !== 'tutorhub_load') {
    throw new Error(`Refusing to seed "${rows[0]?.db ?? '?'}": only tutorhub_load is allowed.`);
  }
  const { rows: existing } = await client.query<{ n: string }>(
    'SELECT count(*) AS n FROM "Booking"',
  );
  if (Number(existing[0]?.n) > 0) {
    throw new Error('tutorhub_load already has bookings. Drop and recreate it to reseed.');
  }

  // Deterministic UUID-shaped ids (md5 → uuid), so rows can reference each
  // other by number without a lookup: tutor n = md5('t' || n)::uuid.
  await step(
    'tutors',
    `INSERT INTO "Tutor" (id, name, timezone, "hourlyCents", "workingHours", email)
     SELECT md5('t' || n)::uuid::text, 'Load Tutor ' || n, 'Europe/Berlin', 3000 + (n % 50) * 100,
            '[{"day":1,"start":"09:00","end":"17:00"},{"day":2,"start":"09:00","end":"17:00"},
              {"day":3,"start":"09:00","end":"17:00"},{"day":4,"start":"09:00","end":"17:00"},
              {"day":5,"start":"09:00","end":"17:00"}]'::jsonb,
            'load-tutor-' || n || '@example.com'
     FROM generate_series(0, $1 - 1) AS n`,
    [TUTORS],
  );
  await step(
    'subjects',
    `INSERT INTO "Subject" (id, name, level, "tutorId")
     SELECT md5('s' || n)::uuid::text, (ARRAY['Mathematics','Physics','Chemistry','English'])[1 + n % 4],
            'ADVANCED', md5('t' || n)::uuid::text
     FROM generate_series(0, $1 - 1) AS n`,
    [TUTORS],
  );
  await step(
    'students',
    `INSERT INTO "Student" (id, "fullName", email)
     SELECT md5('st' || n)::uuid::text, 'Load Student ' || n, 'load-student-' || n || '@example.com'
     FROM generate_series(0, $1 - 1) AS n`,
    [STUDENTS],
  );

  // Booking i of tutor t: weekly, starting 2025-01-06, shifted by (t % 7) days
  // and (t % 13) hours. Same tutor → 7 days apart. The same student (every
  // 200,000th booking) lands on a different day or hour, so the EXCLUDE
  // constraints from Block 2 hold for active rows.
  // Past lessons: 85% COMPLETED / 10% CANCELLED / 5% NO_SHOW.
  // Future: 70% CONFIRMED / 20% PENDING / 10% CANCELLED.
  for (let from = 0; from < TUTORS; from += TUTORS_PER_CHUNK) {
    await step(
      `bookings for tutors ${from}–${from + TUTORS_PER_CHUNK - 1}`,
      `INSERT INTO "Booking" (id, "tutorId", "studentId", "subjectId", "startTime", "endTime",
                              status, "createdAt", "updatedAt")
       SELECT md5('b' || g)::uuid::text,
              md5('t' || t)::uuid::text,
              md5('st' || (g % $3))::uuid::text,
              md5('s' || t)::uuid::text,
              start, start + interval '1 hour',
              (CASE
                 WHEN start < now() THEN
                   CASE WHEN (g::bigint * 7919) % 100 < 85 THEN 'COMPLETED'
                        WHEN (g::bigint * 7919) % 100 < 95 THEN 'CANCELLED' ELSE 'NO_SHOW' END
                 ELSE
                   CASE WHEN (g::bigint * 7919) % 100 < 70 THEN 'CONFIRMED'
                        WHEN (g::bigint * 7919) % 100 < 90 THEN 'PENDING' ELSE 'CANCELLED' END
               END)::"BookingStatus",
              start - ((g % 30) + 1) * interval '1 day',
              start - ((g % 30) + 1) * interval '1 day'
       FROM generate_series($1::int, $2::int) AS t,
            generate_series(0, $4 - 1) AS i,
            LATERAL (SELECT t * $4 + i AS g,
                            timestamp '2025-01-06 08:00'
                              + (i * 7 + t % 7) * interval '1 day'
                              + (t % 13) * interval '1 hour' AS start) AS x`,
      [from, from + TUTORS_PER_CHUNK - 1, STUDENTS, BOOKINGS_PER_TUTOR],
    );
  }

  // One student with 25k past lessons, every 2 hours from 2019 — enough rows
  // for 1,000+ pages of 20, to compare keyset vs OFFSET deep in the list.
  await step(
    'heavy student',
    `INSERT INTO "Student" (id, "fullName", email)
     VALUES (md5('heavy')::uuid::text, 'Heavy Student', 'load-heavy@example.com')`,
  );
  await step(
    'heavy student bookings',
    `INSERT INTO "Booking" (id, "tutorId", "studentId", "subjectId", "startTime", "endTime",
                            status, "createdAt", "updatedAt")
     SELECT md5('hb' || n)::uuid::text, md5('t' || (n % $2))::uuid::text, md5('heavy')::uuid::text,
            md5('s' || (n % $2))::uuid::text,
            timestamp '2019-01-01 06:00' + n * interval '2 hours',
            timestamp '2019-01-01 07:00' + n * interval '2 hours',
            'COMPLETED', timestamp '2018-12-01', timestamp '2018-12-01'
     FROM generate_series(0, $1 - 1) AS n`,
    [HEAVY_STUDENT_BOOKINGS, TUTORS],
  );

  // One busy tutor: 12 lessons a day (08:00–19:00) from 2022-05-01 to late
  // 2026, with their own 5,000 students (the same student comes back every
  // ~416 days, so no overlaps). The last few weeks are in the future → active.
  await step(
    'busy tutor',
    `INSERT INTO "Tutor" (id, name, timezone, "hourlyCents", "workingHours", email)
     VALUES (md5('busy-tutor')::uuid::text, 'Busy Tutor', 'Europe/Berlin', 6000,
             '[{"day":0,"start":"08:00","end":"20:00"},{"day":1,"start":"08:00","end":"20:00"},
               {"day":2,"start":"08:00","end":"20:00"},{"day":3,"start":"08:00","end":"20:00"},
               {"day":4,"start":"08:00","end":"20:00"},{"day":5,"start":"08:00","end":"20:00"},
               {"day":6,"start":"08:00","end":"20:00"}]'::jsonb, 'load-busy-tutor@example.com')`,
  );
  await step(
    'busy tutor subject',
    `INSERT INTO "Subject" (id, name, level, "tutorId")
     VALUES (md5('busy-subject')::uuid::text, 'Mathematics', 'ADVANCED', md5('busy-tutor')::uuid::text)`,
  );
  await step(
    'busy tutor students',
    `INSERT INTO "Student" (id, "fullName", email)
     SELECT md5('bts' || n)::uuid::text, 'Busy Tutor Student ' || n, 'load-bts-' || n || '@example.com'
     FROM generate_series(0, $1 - 1) AS n`,
    [BUSY_TUTOR_STUDENTS],
  );
  await step(
    'busy tutor bookings',
    `INSERT INTO "Booking" (id, "tutorId", "studentId", "subjectId", "startTime", "endTime",
                            status, "createdAt", "updatedAt")
     SELECT md5('btb' || n)::uuid::text, md5('busy-tutor')::uuid::text,
            md5('bts' || (n % $2))::uuid::text, md5('busy-subject')::uuid::text,
            start, start + interval '1 hour',
            (CASE
               WHEN start < now() THEN
                 CASE WHEN (n::bigint * 7919) % 100 < 85 THEN 'COMPLETED'
                      WHEN (n::bigint * 7919) % 100 < 95 THEN 'CANCELLED' ELSE 'NO_SHOW' END
               ELSE
                 CASE WHEN (n::bigint * 7919) % 100 < 70 THEN 'CONFIRMED'
                      WHEN (n::bigint * 7919) % 100 < 90 THEN 'PENDING' ELSE 'CANCELLED' END
             END)::"BookingStatus",
            start - interval '7 days', start - interval '7 days'
     FROM generate_series(0, $1 - 1) AS n,
          LATERAL (SELECT timestamp '2022-05-01 08:00' + (n / 12) * interval '1 day'
                                                       + (n % 12) * interval '1 hour' AS start) AS x`,
    [BUSY_TUTOR_BOOKINGS, BUSY_TUTOR_STUDENTS],
  );

  // Fresh planner statistics, so EXPLAIN reflects the real data.
  await step('analyze', 'ANALYZE');
  const { rows: size } = await client.query<{ total: string; table: string }>(
    `SELECT pg_size_pretty(pg_total_relation_size('"Booking"')) AS total,
            pg_size_pretty(pg_relation_size('"Booking"')) AS table`,
  );
  console.log(`Booking: ${size[0]?.table ?? '?'} table, ${size[0]?.total ?? '?'} with indexes`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void client.end());
