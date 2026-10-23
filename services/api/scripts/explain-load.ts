/**
 * Print `EXPLAIN (ANALYZE, BUFFERS)` for the booking queries measured in
 * docs/QUERY_PERFORMANCE.md, against the load database (scripts/seed-load.ts).
 * Each query runs 3 times; the plan shown is the last (warm-cache) run, with
 * the median execution time.
 *
 *   npx tsx scripts/explain-load.ts            # all queries
 *   npx tsx scripts/explain-load.ts q3-offset  # one query
 */
import pg from 'pg';

const url =
  process.env['LOAD_DATABASE_URL'] ?? 'postgresql://tutorhub:tutorhub@localhost:5432/tutorhub_load';

// Deterministic ids from scripts/seed-load.ts.
const BUSY_TUTOR = "md5('busy-tutor')::uuid::text";
const HEAVY_STUDENT = "md5('heavy')::uuid::text";
// The 20,000th booking of the heavy student = where page 1,000 (of 20) starts.
const PAGE_1000_CURSOR =
  "(timestamp '2019-01-01 06:00' + 19999 * interval '2 hours', md5('hb19999')::uuid::text)";

const QUERIES: Record<string, string> = {
  // 1. Tutor dashboard: the tutor's pending requests, first page (tutorBookingsConnection).
  'q1-dashboard': `SELECT * FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status = 'PENDING'
    ORDER BY "startTime", id LIMIT 21`,

  // 1b. The same list for the tutor's lesson history (thousands of rows).
  'q1-dashboard-past': `SELECT * FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status = 'COMPLETED'
    ORDER BY "startTime", id LIMIT 21`,

  // 2a. Availability for one day — as getSlots did it: every active booking ever.
  'q2-availability-all': `SELECT "startTime", "endTime" FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status IN ('PENDING', 'CONFIRMED')`,
  // 2b. The same, limited to the day being shown (± a day for buffers/timezones).
  'q2-availability-day': `SELECT "startTime", "endTime" FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status IN ('PENDING', 'CONFIRMED')
      AND "startTime" < timestamp '2026-11-04' AND "endTime" > timestamp '2026-11-01'`,

  // 2c. The day window as a range overlap, which the EXCLUDE constraint's
  //     GiST index (tutorId, tsrange) can answer directly.
  'q2-availability-range': `SELECT "startTime", "endTime" FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status IN ('PENDING', 'CONFIRMED')
      AND tsrange("startTime", "endTime", '[)') && tsrange('2026-11-01', '2026-11-04', '[)')`,

  // 3. myBookingsConnection for a student with 25k bookings: page 1 and page 1,000.
  'q3-page1': `SELECT * FROM "Booking" WHERE "studentId" = ${HEAVY_STUDENT}
    ORDER BY "startTime", id LIMIT 21`,
  'q3-keyset-page1000': `SELECT * FROM "Booking" WHERE "studentId" = ${HEAVY_STUDENT}
    AND ("startTime", id) > ${PAGE_1000_CURSOR}
    ORDER BY "startTime", id LIMIT 21`,
  'q3-offset-page1000': `SELECT * FROM "Booking" WHERE "studentId" = ${HEAVY_STUDENT}
    ORDER BY "startTime", id OFFSET 19980 LIMIT 21`,

  // 4a. Analytics lessonsOverTime — as it was: load every completed lesson, bucket in Node.
  'q4-analytics-rows': `SELECT b."studentId", b."startTime", s.name FROM "Booking" b
    JOIN "Subject" s ON s.id = b."subjectId"
    WHERE b."tutorId" = ${BUSY_TUTOR} AND b.status = 'COMPLETED'`,
  // 4b. What the app now does: fetch only the last 8 months (start times only).
  'q4-analytics-window': `SELECT "startTime" FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status = 'COMPLETED'
      AND "startTime" >= date_trunc('month', timestamp '2026-10-23') - interval '7 months'`,
  // 4c. The same answer computed in Postgres: last 8 months, one row per month.
  'q4-analytics-sql': `SELECT date_trunc('month', "startTime") AS month, count(*)::int AS count
    FROM "Booking"
    WHERE "tutorId" = ${BUSY_TUTOR} AND status = 'COMPLETED'
      AND "startTime" >= date_trunc('month', timestamp '2026-10-23') - interval '7 months'
    GROUP BY 1 ORDER BY 1`,
};

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
  if (rows[0]?.db !== 'tutorhub_load') throw new Error('Run this against tutorhub_load only.');

  const only = process.argv[2];
  for (const [name, sql] of Object.entries(QUERIES)) {
    if (only !== undefined && !name.startsWith(only)) continue;
    const times: number[] = [];
    let plan: string[] = [];
    for (let run = 0; run < 3; run++) {
      const result = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
      );
      plan = result.rows.map((row) => row['QUERY PLAN']);
      const line = plan.find((l) => l.startsWith('Execution Time'));
      times.push(Number(line?.match(/[\d.]+/)?.[0] ?? NaN));
    }
    times.sort((a, b) => a - b);
    console.log(`\n### ${name} — median ${times[1]?.toFixed(3) ?? '?'} ms\n`);
    console.log(plan.join('\n'));
  }
  await client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
