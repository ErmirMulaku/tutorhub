-- Step 2 of 2 (see the previous migration): drop the old (studentId,
-- startTime) index, now covered by (studentId, startTime, id). DROP INDEX
-- CONCURRENTLY doesn't block reads or writes while it waits for its lock.
-- One statement per file, for the same reason as the CREATE.
DROP INDEX CONCURRENTLY IF EXISTS "Booking_studentId_startTime_idx";
