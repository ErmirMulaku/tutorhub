-- Remove subjects invented from service names.
--
-- 20260716190000_backfill_tutor_listing created a subject for every distinct
-- service name and level, so tutors whose services had no subject could still be
-- found. It should have skipped services that already pointed at one. Seeded
-- catalogs do, so their product names became subjects and those tutors now
-- appear to teach them:
--
--   Lena Hartmann — Mathematics, Physics
--                 + One-to-one Maths, One-to-one Physics,
--                   Group problem-solving, Exam-prep bundle
--
-- This targets only what that migration invented: a subject nothing points at,
-- with no bookings, whose name belongs to a service of the same tutor that was
-- already linked to a different subject. A real subject has services or bookings
-- against it; one a tutor added by hand has no service of that name. Both stay.
DELETE FROM "Subject" AS s
WHERE NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."subjectId" = s.id)
  AND NOT EXISTS (SELECT 1 FROM "Service" sv WHERE sv."subjectId" = s.id)
  AND EXISTS (
    SELECT 1 FROM "Service" sv2
    WHERE sv2."tutorId" = s."tutorId"
      AND sv2.level = s.level
      AND lower(sv2.name) = lower(s.name)
      AND sv2."subjectId" IS NOT NULL
      AND sv2."subjectId" <> s.id
  );
