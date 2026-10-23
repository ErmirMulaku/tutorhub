-- The discover page's default order — best rated first, then oldest — over
-- published tutors only. A partial index (WHERE "isActive") skips unpublished
-- signups, and its column order matches the ORDER BY, so a page is read
-- straight off the index instead of sorting every tutor. Prisma can't model a
-- partial index, so it lives only here. One statement per file: CONCURRENTLY
-- can't run inside `migrate dev`'s transaction (see Block 6).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tutor_discover_rating_idx" ON "Tutor" ("ratingAvg" DESC NULLS LAST, "createdAt", "id") WHERE "isActive";
