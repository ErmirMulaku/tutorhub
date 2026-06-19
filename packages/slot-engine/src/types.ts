/** Public types for `@ermulaku/slot-engine`. */

/**
 * An absolute instant as an ISO-8601 UTC string, e.g.
 * `"2025-03-30T08:00:00.000Z"`. Always serialised with a trailing `Z`.
 */
export type IsoDateTime = string;

/**
 * A recurring weekly availability window in the tutor's local timezone.
 *
 * If `end` is less than or equal to `start`, the window **crosses midnight**
 * and ends on the following calendar day (e.g. `22:00`→`02:00`).
 */
export interface WorkingWindow {
  /** Day of week, `0` = Sunday … `6` = Saturday (matches `Date#getUTCDay`). */
  day: number;
  /** Inclusive start as 24-hour wall clock, `"HH:mm"`. */
  start: string;
  /** Exclusive end as 24-hour wall clock, `"HH:mm"`. */
  end: string;
}

/** A booked interval that makes overlapping time unavailable. */
export interface BookingInterval {
  start: IsoDateTime;
  end: IsoDateTime;
}

/** A bookable slot returned by the engine. */
export interface Slot {
  start: IsoDateTime;
  end: IsoDateTime;
}

/** Tuning options for {@link GetAvailableSlotsParams}. */
export interface SlotOptions {
  /** IANA timezone the working hours are expressed in, e.g. `"Europe/Belgrade"`. */
  timezone: string;
  /** Minimum gap (minutes) to keep on each side of every booking. Default `0`. */
  bufferMinutes?: number;
  /** Minimum notice (minutes) from `now` before a slot may start. Default `0`. */
  leadMinutes?: number;
  /** Non-bookable windows subtracted from working hours. Default `[]`. */
  breaks?: WorkingWindow[];
  /** Injected "now" for deterministic output. Default `new Date()`. */
  now?: IsoDateTime;
}

/** Input to {@link getAvailableSlots}. */
export interface GetAvailableSlotsParams {
  /** Recurring weekly availability windows. */
  workingHours: WorkingWindow[];
  /** Existing bookings that block overlapping slots. */
  existingBookings: BookingInterval[];
  /** Slot length in minutes (must be `> 0`). */
  slotMinutes: number;
  /** Target calendar day `"YYYY-MM-DD"`, interpreted in `options.timezone`. */
  date: string;
  options: SlotOptions;
}
