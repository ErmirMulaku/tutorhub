import type { BookingStatus } from '@ermulaku/types';
import { ConflictDomainError } from '../common/errors.js';

/**
 * Transport-agnostic domain error. The HTTP layer maps it to a status code via
 * {@link DomainExceptionFilter}; GraphQL/gRPC (later phases) map it to their own
 * error shapes. The service layer never throws framework-specific exceptions.
 */
export class InvalidBookingTransitionError extends Error {
  constructor(
    readonly from: BookingStatus,
    readonly to: BookingStatus,
  ) {
    super(`Cannot transition a booking from ${from} to ${to}.`);
    this.name = 'InvalidBookingTransitionError';
  }
}

/**
 * The time overlaps another active booking of the same tutor or the same
 * student. Raised when the database's EXCLUDE constraint rejects the write
 * (see the `booking_no_overlap` migration), so it holds under any race.
 * A 409 with code `SLOT_UNAVAILABLE`.
 */
export class SlotUnavailableError extends ConflictDomainError {
  constructor(readonly busy: 'tutor' | 'student') {
    super(
      busy === 'tutor'
        ? 'The tutor already has a lesson at this time.'
        : 'You already have a lesson at this time.',
      'SLOT_UNAVAILABLE',
    );
    this.name = 'SlotUnavailableError';
  }
}
