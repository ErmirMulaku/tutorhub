/**
 * `tutorhub-slot-engine` — a zero-dependency, timezone- and DST-aware engine
 * that computes bookable lesson slots for a tutor on a given day.
 *
 * @packageDocumentation
 */

export { getAvailableSlots } from './get-available-slots.js';
export { getOffsetMs, zonedWallTimeToUtcMs } from './timezone.js';
export type {
  BookingInterval,
  GetAvailableSlotsParams,
  IsoDateTime,
  Slot,
  SlotOptions,
  WorkingWindow,
} from './types.js';
