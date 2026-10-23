/**
 * Zero-downtime column change, step 2 of 3: BACKFILL `Booking.source`
 * (docs/FRESHA_DEPTH_SPEC.md Block 6; step 1 is the `booking_source_expand`
 * migration, step 3 the `booking_source_contract` migration).
 *
 * Fills `source` for rows that don't have one yet, 10,000 at a time, pausing
 * between batches, while the app keeps running:
 *
 * - Small batches: each UPDATE locks only its 10k rows, for a short time, and
 *   writes a bounded amount of WAL — replicas keep up, nothing waits long.
 *   One `UPDATE … WHERE source IS NULL` over 2M rows would lock them all for
 *   the whole run and produce one huge transaction.
 * - Pauses: leave room for real traffic (and autovacuum) between batches.
 * - Resumable: it only ever touches rows that are still NULL, so stopping it
 *   (Ctrl+C, a deploy) and starting again just carries on.
 * - Walks the primary key in order (`id > last`), so each batch finds its rows
 *   through the index instead of rescanning the table for NULLs.
 *
 * - Ids are random UUIDs, so while old app versions are still running they
 *   can insert NULL rows *behind* the cursor. That's why the contract step
 *   comes later: run this once more from the start (it's cheap — almost
 *   nothing is NULL) after every pod writes `source`, then contract.
 *
 * Old rows predate the column, so their real source is unknown; they get WEB
 * (where bookings came from before the dashboard and the assistant could
 * book). That's a documented guess, not data.
 *
 *   DATABASE_URL=… npx tsx scripts/backfill-booking-source.ts
 */
import 'dotenv/config';
import pg from 'pg';

const BATCH = 10_000;
const PAUSE_MS = 200;

const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') throw new Error('Set DATABASE_URL.');
const client = new pg.Client({ connectionString: url });

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  await client.connect();
  // Don't wait behind a long lock; fail the batch and let the next run retry.
  await client.query("SET lock_timeout = '2s'");
  let lastId = '';
  let total = 0;
  const started = Date.now();
  for (;;) {
    const result = await client.query<{ id: string }>(
      `UPDATE "Booking" SET source = 'WEB'
       WHERE id IN (
         SELECT id FROM "Booking"
         WHERE id > $1 AND source IS NULL
         ORDER BY id
         LIMIT $2
       )
       RETURNING id`,
      [lastId, BATCH],
    );
    if (result.rowCount === 0) break;
    total += result.rowCount ?? 0;
    lastId = result.rows.reduce((max, row) => (row.id > max ? row.id : max), lastId);
    console.log(`backfilled ${total} rows (last id ${lastId})`);
    await sleep(PAUSE_MS);
  }
  const { rows } = await client.query<{ n: string }>(
    'SELECT count(*) AS n FROM "Booking" WHERE source IS NULL',
  );
  console.log(
    `done: ${total} rows in ${((Date.now() - started) / 1000).toFixed(1)}s; ${rows[0]?.n ?? '?'} still NULL`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void client.end());
