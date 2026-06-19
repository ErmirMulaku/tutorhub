import { describe, expect, it } from '@jest/globals';
import { BookingStatus } from '@ermulaku/types';
import {
  BOOKING_STATUS_TRANSITIONS,
  assertCanTransition,
  canTransition,
} from '../booking-status.js';
import { InvalidBookingTransitionError } from '../booking.errors.js';

const ALL = Object.values(BookingStatus);

/** The complete set of allowed (from → to) edges, asserted exhaustively below. */
const ALLOWED: ReadonlyArray<readonly [BookingStatus, BookingStatus]> = [
  [BookingStatus.Pending, BookingStatus.Confirmed],
  [BookingStatus.Pending, BookingStatus.Cancelled],
  [BookingStatus.Confirmed, BookingStatus.Completed],
  [BookingStatus.Confirmed, BookingStatus.Cancelled],
  [BookingStatus.Confirmed, BookingStatus.NoShow],
];

function isAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED.some(([f, t]) => f === from && t === to);
}

describe('booking status transitions', () => {
  it('matches the documented allow-list exactly, for every from→to pair', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(isAllowed(from, to));
      }
    }
  });

  it('never allows a status to transition to itself', () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('treats COMPLETED, CANCELLED and NO_SHOW as terminal', () => {
    for (const terminal of [
      BookingStatus.Completed,
      BookingStatus.Cancelled,
      BookingStatus.NoShow,
    ]) {
      expect(BOOKING_STATUS_TRANSITIONS[terminal]).toEqual([]);
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  describe('assertCanTransition', () => {
    it('does not throw for an allowed transition', () => {
      expect(() => {
        assertCanTransition(BookingStatus.Pending, BookingStatus.Confirmed);
      }).not.toThrow();
    });

    it('throws InvalidBookingTransitionError for a disallowed transition', () => {
      expect(() => {
        assertCanTransition(BookingStatus.Completed, BookingStatus.Pending);
      }).toThrow(InvalidBookingTransitionError);
    });

    it('reports the from/to on the thrown error', () => {
      expect.assertions(2);
      try {
        assertCanTransition(BookingStatus.Cancelled, BookingStatus.Confirmed);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidBookingTransitionError);
        expect((error as InvalidBookingTransitionError).from).toBe(BookingStatus.Cancelled);
      }
    });
  });
});
