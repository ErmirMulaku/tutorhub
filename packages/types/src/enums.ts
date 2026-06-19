/**
 * Domain enumerations shared across the monorepo (SPEC §8).
 *
 * Modelled as `as const` objects with a derived union type rather than
 * TypeScript `enum`s: this gives a runtime value map *and* a structural
 * string-literal type, stays tree-shakeable, and serialises cleanly to JSON
 * across REST / GraphQL / gRPC boundaries.
 */

/** Skill level of a {@link Subject}. */
export const Level = {
  Beginner: 'BEGINNER',
  Intermediate: 'INTERMEDIATE',
  Advanced: 'ADVANCED',
} as const;
export type Level = (typeof Level)[keyof typeof Level];

/**
 * Lifecycle of a {@link Booking}.
 * `PENDING → CONFIRMED → COMPLETED`, with `CANCELLED` / `NO_SHOW` as terminal
 * exits. Transition rules are enforced by the API's BookingService (Phase 2).
 */
export const BookingStatus = {
  Pending: 'PENDING',
  Confirmed: 'CONFIRMED',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
  NoShow: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Lifecycle of a {@link Payment} (mocked provider — no real card data). */
export const PaymentStatus = {
  Pending: 'PENDING',
  Paid: 'PAID',
  Refunded: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
