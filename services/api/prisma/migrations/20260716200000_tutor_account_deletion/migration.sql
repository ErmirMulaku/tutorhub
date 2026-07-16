-- Tell students when a tutor closing their account cancels a lesson.
--
-- Their bookings are about to stop existing, so the notice is the only thing
-- left to tell them — Notification hangs off Student, not Booking, so it
-- outlives the lesson it refers to.
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CANCELLED';
