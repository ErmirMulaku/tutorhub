-- Zero-downtime column change, step 1 of 3: EXPAND (FRESHA_DEPTH_SPEC Block 6).
--   1. expand   — this file: add the column as NULLABLE. Old app versions that
--                 don't know about it keep working (they just leave it NULL).
--   2. backfill — scripts/backfill-booking-source.ts fills old rows in small
--                 batches while the app runs; new code writes it on every insert.
--   3. contract — a later migration makes it NOT NULL (CHECK … NOT VALID,
--                 VALIDATE, then SET NOT NULL), once every app version writes it.
--
-- ADD COLUMN with no default is a catalog-only change (no table rewrite), but
-- it still needs a brief ACCESS EXCLUSIVE lock. If a long transaction holds a
-- lock on "Booking", our ALTER would queue behind it — and every query that
-- arrives after us would queue behind *us*. lock_timeout makes the ALTER give
-- up after 3 s instead (retry later) rather than freeze the table.
--
-- The SET applies to this migration's session. (Checked on Prisma 7.8:
-- `migrate deploy` runs the statements one by one; `migrate dev` wraps a
-- multi-statement file in one transaction. Either way the SET covers the
-- ALTER below.)
SET lock_timeout = '3s';

CREATE TYPE "BookingSource" AS ENUM ('WEB', 'MOBILE', 'DASHBOARD', 'ASSISTANT');

ALTER TABLE "Booking" ADD COLUMN "source" "BookingSource";
