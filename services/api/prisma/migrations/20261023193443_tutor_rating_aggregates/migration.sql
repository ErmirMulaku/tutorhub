-- Keep each tutor's review aggregates on the tutor row, so the discover page
-- can filter and sort by rating in SQL and fetch one page. Before this, it
-- loaded every tutor and every rating into Node to sort them — fine for 20
-- tutors, a crash ("Maximum call stack size exceeded") at 200k.
--
-- New columns with constant defaults are catalog-only (no table rewrite).
SET lock_timeout = '3s';

ALTER TABLE "Tutor"
  ADD COLUMN "ratingSum"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ratingAvg"   DOUBLE PRECISION;

-- Count the reviews that already exist. One statement is fine at today's
-- size (the Review table is small); on a big table this would be a batched
-- backfill like scripts/backfill-booking-source.ts.
UPDATE "Tutor" t
SET "ratingSum" = r.sum, "ratingCount" = r.count, "ratingAvg" = r.sum::float / r.count
FROM (SELECT "tutorId", sum(rating)::int AS sum, count(*)::int AS count
      FROM "Review" GROUP BY "tutorId") r
WHERE r."tutorId" = t.id;
