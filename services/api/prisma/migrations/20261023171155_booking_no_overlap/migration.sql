-- Make double booking impossible in the database itself (FRESHA_DEPTH_SPEC
-- Block 2). The app still checks availability for a friendly UI, but two
-- requests can both pass that check at the same moment; these constraints are
-- the guarantee.
--
-- Prisma does not model EXCLUDE constraints, so they live only in this SQL.
-- Checked: running `prisma migrate dev` afterwards reports no drift and does
-- not generate a migration that drops them (Prisma ignores constraints it
-- doesn't know about when diffing).
--
-- startTime/endTime are TIMESTAMP(3) WITHOUT time zone (UTC by convention),
-- so the range type is tsrange, not tstzrange. '[)' = start included, end
-- excluded: 10:00-11:00 and 11:00-12:00 touch but do not overlap.
--
-- Only PENDING/CONFIRMED bookings hold a slot; a CANCELLED one frees it.

-- Lets a GiST index compare plain equality (tutorId =) next to ranges (&&).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT booking_no_tutor_overlap
  EXCLUDE USING gist ("tutorId" WITH =, tsrange("startTime", "endTime", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Booking" ADD CONSTRAINT booking_no_student_overlap
  EXCLUDE USING gist ("studentId" WITH =, tsrange("startTime", "endTime", '[)') WITH &&)
  WHERE (status IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Booking" ADD CONSTRAINT booking_end_after_start CHECK ("endTime" > "startTime");
