import type { BookingStatus } from '@ermulaku/types';

/**
 * Transport-agnostic domain errors. The HTTP layer maps these to status codes
 * via an exception filter; GraphQL/gRPC (later phases) map them to their own
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

export class BookingNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Booking ${id} was not found.`);
    this.name = 'BookingNotFoundError';
  }
}
