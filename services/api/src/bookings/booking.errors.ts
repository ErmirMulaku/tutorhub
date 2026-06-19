import type { BookingStatus } from '@ermulaku/types';

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
