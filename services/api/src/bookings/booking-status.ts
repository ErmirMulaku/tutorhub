import { BookingStatus } from '@ermulaku/types';
import { InvalidBookingTransitionError } from './booking.errors.js';

/**
 * The booking lifecycle state machine — the single source of truth reused by
 * REST, GraphQL, and gRPC (SPEC §8):
 *
 *   PENDING ─▶ CONFIRMED ─▶ COMPLETED
 *      │           │
 *      └─▶ CANCELLED ◀┘
 *                  └─▶ NO_SHOW
 *
 * COMPLETED / CANCELLED / NO_SHOW are terminal.
 */
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  [BookingStatus.Pending]: [BookingStatus.Confirmed, BookingStatus.Cancelled],
  [BookingStatus.Confirmed]: [
    BookingStatus.Completed,
    BookingStatus.Cancelled,
    BookingStatus.NoShow,
  ],
  [BookingStatus.Completed]: [],
  [BookingStatus.Cancelled]: [],
  [BookingStatus.NoShow]: [],
};

/** Whether `to` is a legal next status from `from`. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

/** Throws {@link InvalidBookingTransitionError} if the transition is not allowed. */
export function assertCanTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidBookingTransitionError(from, to);
  }
}
