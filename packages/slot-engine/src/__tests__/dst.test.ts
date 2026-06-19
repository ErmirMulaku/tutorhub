import { describe, expect, it } from '@jest/globals';
import { getAvailableSlots } from '../get-available-slots.js';
import type { GetAvailableSlotsParams } from '../types.js';

/**
 * DST correctness for Europe/Belgrade (CET = UTC+1, CEST = UTC+2):
 * - spring forward: 2025-03-30, 02:00 CET → 03:00 CEST (an hour is lost)
 * - fall back:      2025-10-26, 03:00 CEST → 02:00 CET (an hour is repeated)
 *
 * Because the engine reasons in absolute UTC, a working window that spans the
 * transition has its *real* duration adjusted automatically, which changes how
 * many fixed-length slots fit. All four dates below are Sundays (day 0).
 */
function sundayParams(date: string): GetAvailableSlotsParams {
  return {
    workingHours: [{ day: 0, start: '01:00', end: '05:00' }],
    existingBookings: [],
    slotMinutes: 60,
    date,
    options: { timezone: 'Europe/Belgrade', now: '2025-01-01T00:00:00.000Z' },
  };
}

describe('DST spring-forward (lost hour shrinks availability)', () => {
  it('a normal Sunday yields four 1-hour slots', () => {
    // 2025-03-23: 01:00–05:00 CET (UTC+1) = 00:00Z–04:00Z = 4 hours.
    expect(getAvailableSlots(sundayParams('2025-03-23'))).toEqual([
      { start: '2025-03-23T00:00:00.000Z', end: '2025-03-23T01:00:00.000Z' },
      { start: '2025-03-23T01:00:00.000Z', end: '2025-03-23T02:00:00.000Z' },
      { start: '2025-03-23T02:00:00.000Z', end: '2025-03-23T03:00:00.000Z' },
      { start: '2025-03-23T03:00:00.000Z', end: '2025-03-23T04:00:00.000Z' },
    ]);
  });

  it('the spring-forward Sunday yields only three (the 02:00–03:00 hour is lost)', () => {
    // 2025-03-30: 01:00 CET = 00:00Z, 05:00 CEST = 03:00Z = 3 real hours.
    expect(getAvailableSlots(sundayParams('2025-03-30'))).toEqual([
      { start: '2025-03-30T00:00:00.000Z', end: '2025-03-30T01:00:00.000Z' },
      { start: '2025-03-30T01:00:00.000Z', end: '2025-03-30T02:00:00.000Z' },
      { start: '2025-03-30T02:00:00.000Z', end: '2025-03-30T03:00:00.000Z' },
    ]);
  });
});

describe('DST fall-back (gained hour adds availability)', () => {
  it('a normal Sunday yields four 1-hour slots', () => {
    // 2025-10-19: 01:00–05:00 CEST (UTC+2) = 23:00Z(prev)–03:00Z = 4 hours.
    expect(getAvailableSlots(sundayParams('2025-10-19'))).toEqual([
      { start: '2025-10-18T23:00:00.000Z', end: '2025-10-19T00:00:00.000Z' },
      { start: '2025-10-19T00:00:00.000Z', end: '2025-10-19T01:00:00.000Z' },
      { start: '2025-10-19T01:00:00.000Z', end: '2025-10-19T02:00:00.000Z' },
      { start: '2025-10-19T02:00:00.000Z', end: '2025-10-19T03:00:00.000Z' },
    ]);
  });

  it('the fall-back Sunday yields five (the 02:00–03:00 hour is repeated)', () => {
    // 2025-10-26: 01:00 CEST = 23:00Z(prev), 05:00 CET = 04:00Z = 5 real hours.
    expect(getAvailableSlots(sundayParams('2025-10-26'))).toEqual([
      { start: '2025-10-25T23:00:00.000Z', end: '2025-10-26T00:00:00.000Z' },
      { start: '2025-10-26T00:00:00.000Z', end: '2025-10-26T01:00:00.000Z' },
      { start: '2025-10-26T01:00:00.000Z', end: '2025-10-26T02:00:00.000Z' },
      { start: '2025-10-26T02:00:00.000Z', end: '2025-10-26T03:00:00.000Z' },
      { start: '2025-10-26T03:00:00.000Z', end: '2025-10-26T04:00:00.000Z' },
    ]);
  });
});

describe('DST does not affect a daytime window away from the transition', () => {
  it('shifts only the UTC offset between winter and summer', () => {
    const base: GetAvailableSlotsParams = {
      workingHours: [{ day: 1, start: '09:00', end: '11:00' }],
      existingBookings: [],
      slotMinutes: 60,
      date: '2025-01-13', // Monday, CET
      options: { timezone: 'Europe/Belgrade', now: '2025-01-01T00:00:00.000Z' },
    };
    const winter = getAvailableSlots(base).map((s) => s.start);
    const summer = getAvailableSlots({ ...base, date: '2025-07-14' }).map((s) => s.start);

    expect(winter).toEqual(['2025-01-13T08:00:00.000Z', '2025-01-13T09:00:00.000Z']);
    expect(summer).toEqual(['2025-07-14T07:00:00.000Z', '2025-07-14T08:00:00.000Z']);
  });
});
