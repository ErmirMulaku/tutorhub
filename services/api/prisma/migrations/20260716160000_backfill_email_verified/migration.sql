-- Grandfather every account that predates verification being enforced.
--
-- `emailVerified` defaults to false and, until now, nothing ever read it —
-- sign-in checked only the password. Tutor verification did not exist before
-- 2026-07-16 at all, so every tutor who signed up has `false` despite never
-- having been offered a way to verify. Enforcing the check without this would
-- lock every existing account out of an account it can currently use.
--
-- This deliberately trusts existing rows rather than existing evidence of
-- verification: there is no such evidence to consult, and availability for real
-- accounts beats re-verifying a set that is, in practice, the owner's own.
--
-- Signups after this migration are unaffected — they are created with `false`
-- and must verify.
UPDATE "Tutor" SET "emailVerified" = true WHERE "emailVerified" = false;
UPDATE "Student" SET "emailVerified" = true WHERE "emailVerified" = false;
