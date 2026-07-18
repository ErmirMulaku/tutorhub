/**
 * Core domain entities (SPEC §3 / §8).
 *
 * These describe the *scalar + foreign-key* shape of each record — the row
 * shape stored in Postgres and the lowest common denominator shared by REST,
 * GraphQL, and gRPC. Resolved relation graphs (e.g. a Tutor with its nested
 * subjects/reviews) are composed per-query at the API layer and are not baked
 * into these base types.
 *
 * Timestamps are ISO-8601 UTC strings (e.g. `"2025-03-30T08:00:00.000Z"`) to
 * stay serialisable and consistent with `tutorhub-slot-engine`.
 */

import type { BookingStatus, Level, PaymentStatus } from './enums.js';

/** A single weekly availability window in the tutor's local timezone. */
export interface WorkingHours {
  /** Day of week, 0 = Sunday … 6 = Saturday (matches `Date.prototype.getUTCDay`). */
  day: number;
  /** Inclusive start, 24h wall-clock `"HH:mm"`. */
  start: string;
  /** Exclusive end, 24h wall-clock `"HH:mm"`. */
  end: string;
}

/** A provider who offers lessons. */
export interface Tutor {
  id: string;
  name: string;
  bio: string | null;
  /** IANA timezone, e.g. `"Europe/Belgrade"`. */
  timezone: string;
  hourlyCents: number;
  workingHours: WorkingHours[];
  isActive: boolean;
  createdAt: string;
}

/** Something a tutor teaches (e.g. Guitar, Math) at a given level. */
export interface Subject {
  id: string;
  name: string;
  level: Level;
  tutorId: string;
}

/** A consumer who books lessons. */
export interface Student {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

/** A student's reservation of a tutor for a time slot. */
export interface Booking {
  id: string;
  tutorId: string;
  studentId: string;
  subjectId: string;
  /** Lesson start, ISO-8601 UTC. */
  startTime: string;
  /** Lesson end, ISO-8601 UTC. */
  endTime: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

/** A student's rating/comment on a completed booking. */
export interface Review {
  id: string;
  bookingId: string;
  tutorId: string;
  /** Integer 1–5. */
  rating: number;
  comment: string | null;
}

/** A charge tied to a booking (mocked provider). */
export interface Payment {
  id: string;
  bookingId: string;
  amountCents: number;
  status: PaymentStatus;
}
