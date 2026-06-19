import { describe, expect, it } from '@jest/globals';
import { getAvailableSlots } from '../get-available-slots.js';
import type { GetAvailableSlotsParams } from '../types.js';

/** 2025-06-02 is a Monday (day-of-week 1); a day with no DST transition. */
const MONDAY = '2025-06-02';
/** A `now` well before the test day so lead-time never filters unless asked. */
const EARLY_NOW = '2025-06-01T00:00:00.000Z';

function build(overrides: Partial<GetAvailableSlotsParams> = {}): GetAvailableSlotsParams {
  return {
    workingHours: [{ day: 1, start: '09:00', end: '12:00' }],
    existingBookings: [],
    slotMinutes: 60,
    date: MONDAY,
    options: { timezone: 'UTC', now: EARLY_NOW },
    ...overrides,
  };
}

/** Convenience: pluck just the start instants for compact assertions. */
function starts(params: GetAvailableSlotsParams): string[] {
  return getAvailableSlots(params).map((slot) => slot.start);
}

describe('getAvailableSlots — basic generation', () => {
  it('generates a contiguous grid across the window', () => {
    expect(getAvailableSlots(build())).toEqual([
      { start: '2025-06-02T09:00:00.000Z', end: '2025-06-02T10:00:00.000Z' },
      { start: '2025-06-02T10:00:00.000Z', end: '2025-06-02T11:00:00.000Z' },
      { start: '2025-06-02T11:00:00.000Z', end: '2025-06-02T12:00:00.000Z' },
    ]);
  });

  it('honours slotMinutes (30-minute slots)', () => {
    expect(
      starts(build({ slotMinutes: 30, workingHours: [{ day: 1, start: '09:00', end: '10:30' }] })),
    ).toEqual(['2025-06-02T09:00:00.000Z', '2025-06-02T09:30:00.000Z', '2025-06-02T10:00:00.000Z']);
  });

  it('discards a trailing partial slot that does not fit', () => {
    // 09:00–12:30 with 60-minute slots → 3 full slots; the 12:00–13:00 would overflow.
    expect(starts(build({ workingHours: [{ day: 1, start: '09:00', end: '12:30' }] }))).toEqual([
      '2025-06-02T09:00:00.000Z',
      '2025-06-02T10:00:00.000Z',
      '2025-06-02T11:00:00.000Z',
    ]);
  });

  it('returns [] when there are no working hours', () => {
    expect(getAvailableSlots(build({ workingHours: [] }))).toEqual([]);
  });

  it('returns [] when no window matches the day of week', () => {
    expect(
      getAvailableSlots(build({ workingHours: [{ day: 2, start: '09:00', end: '17:00' }] })),
    ).toEqual([]);
  });

  it('returns [] when the slot is longer than the window', () => {
    expect(getAvailableSlots(build({ slotMinutes: 240 }))).toEqual([]);
  });
});

describe('getAvailableSlots — multiple windows', () => {
  it('treats the gap between two windows as an implicit break', () => {
    expect(
      starts(
        build({
          workingHours: [
            { day: 1, start: '09:00', end: '12:00' },
            { day: 1, start: '13:00', end: '15:00' },
          ],
        }),
      ),
    ).toEqual([
      '2025-06-02T09:00:00.000Z',
      '2025-06-02T10:00:00.000Z',
      '2025-06-02T11:00:00.000Z',
      '2025-06-02T13:00:00.000Z',
      '2025-06-02T14:00:00.000Z',
    ]);
  });

  it('sorts output ascending even when windows are given out of order', () => {
    expect(
      starts(
        build({
          workingHours: [
            { day: 1, start: '13:00', end: '15:00' },
            { day: 1, start: '09:00', end: '11:00' },
          ],
        }),
      ),
    ).toEqual([
      '2025-06-02T09:00:00.000Z',
      '2025-06-02T10:00:00.000Z',
      '2025-06-02T13:00:00.000Z',
      '2025-06-02T14:00:00.000Z',
    ]);
  });
});

describe('getAvailableSlots — bookings and buffer', () => {
  const window = [{ day: 1, start: '08:00', end: '13:00' }];

  it('blocks exactly the overlapping slot (buffer 0, adjacent allowed)', () => {
    expect(
      starts(
        build({
          workingHours: window,
          existingBookings: [
            { start: '2025-06-02T10:00:00.000Z', end: '2025-06-02T11:00:00.000Z' },
          ],
        }),
      ),
    ).toEqual([
      '2025-06-02T08:00:00.000Z',
      '2025-06-02T09:00:00.000Z',
      '2025-06-02T11:00:00.000Z',
      '2025-06-02T12:00:00.000Z',
    ]);
  });

  it('extends blocking to neighbours via bufferMinutes', () => {
    expect(
      starts(
        build({
          workingHours: window,
          existingBookings: [
            { start: '2025-06-02T10:00:00.000Z', end: '2025-06-02T11:00:00.000Z' },
          ],
          options: { timezone: 'UTC', now: EARLY_NOW, bufferMinutes: 15 },
        }),
      ),
    ).toEqual(['2025-06-02T08:00:00.000Z', '2025-06-02T12:00:00.000Z']);
  });

  it('blocks a slot that fully contains a short booking', () => {
    expect(
      starts(
        build({
          existingBookings: [
            { start: '2025-06-02T10:15:00.000Z', end: '2025-06-02T10:45:00.000Z' },
          ],
        }),
      ),
    ).toEqual(['2025-06-02T09:00:00.000Z', '2025-06-02T11:00:00.000Z']);
  });

  it('handles multiple overlapping bookings', () => {
    expect(
      starts(
        build({
          workingHours: [{ day: 1, start: '09:00', end: '13:00' }],
          existingBookings: [
            { start: '2025-06-02T10:00:00.000Z', end: '2025-06-02T11:00:00.000Z' },
            { start: '2025-06-02T10:30:00.000Z', end: '2025-06-02T11:30:00.000Z' },
          ],
        }),
      ),
    ).toEqual(['2025-06-02T09:00:00.000Z', '2025-06-02T12:00:00.000Z']);
  });

  it('ignores bookings that fall outside the working window', () => {
    expect(
      starts(
        build({
          existingBookings: [
            { start: '2025-06-02T20:00:00.000Z', end: '2025-06-02T21:00:00.000Z' },
          ],
        }),
      ),
    ).toEqual(['2025-06-02T09:00:00.000Z', '2025-06-02T10:00:00.000Z', '2025-06-02T11:00:00.000Z']);
  });
});

describe('getAvailableSlots — breaks', () => {
  it('removes slots overlapping an explicit break', () => {
    expect(
      starts(
        build({
          workingHours: [{ day: 1, start: '09:00', end: '17:00' }],
          options: {
            timezone: 'UTC',
            now: EARLY_NOW,
            breaks: [{ day: 1, start: '12:00', end: '13:00' }],
          },
        }),
      ),
    ).toEqual([
      '2025-06-02T09:00:00.000Z',
      '2025-06-02T10:00:00.000Z',
      '2025-06-02T11:00:00.000Z',
      '2025-06-02T13:00:00.000Z',
      '2025-06-02T14:00:00.000Z',
      '2025-06-02T15:00:00.000Z',
      '2025-06-02T16:00:00.000Z',
    ]);
  });

  it('ignores breaks on a different day of week', () => {
    expect(
      starts(
        build({
          options: {
            timezone: 'UTC',
            now: EARLY_NOW,
            breaks: [{ day: 2, start: '10:00', end: '11:00' }],
          },
        }),
      ),
    ).toEqual(['2025-06-02T09:00:00.000Z', '2025-06-02T10:00:00.000Z', '2025-06-02T11:00:00.000Z']);
  });
});

describe('getAvailableSlots — lead time', () => {
  it('drops slots that start before now', () => {
    expect(
      starts(build({ options: { timezone: 'UTC', now: '2025-06-02T09:30:00.000Z' } })),
    ).toEqual(['2025-06-02T10:00:00.000Z', '2025-06-02T11:00:00.000Z']);
  });

  it('enforces leadMinutes notice from now', () => {
    expect(
      starts(
        build({ options: { timezone: 'UTC', now: '2025-06-02T08:00:00.000Z', leadMinutes: 90 } }),
      ),
    ).toEqual(['2025-06-02T10:00:00.000Z', '2025-06-02T11:00:00.000Z']);
  });

  it('keeps a slot starting exactly at the lead cutoff', () => {
    expect(
      starts(
        build({ options: { timezone: 'UTC', now: '2025-06-02T08:00:00.000Z', leadMinutes: 60 } }),
      ),
    ).toEqual(['2025-06-02T09:00:00.000Z', '2025-06-02T10:00:00.000Z', '2025-06-02T11:00:00.000Z']);
  });
});

describe('getAvailableSlots — midnight-crossing window', () => {
  it('carries a window past midnight into the next calendar day', () => {
    expect(
      getAvailableSlots(build({ workingHours: [{ day: 1, start: '22:00', end: '02:00' }] })),
    ).toEqual([
      { start: '2025-06-02T22:00:00.000Z', end: '2025-06-02T23:00:00.000Z' },
      { start: '2025-06-02T23:00:00.000Z', end: '2025-06-03T00:00:00.000Z' },
      { start: '2025-06-03T00:00:00.000Z', end: '2025-06-03T01:00:00.000Z' },
      { start: '2025-06-03T01:00:00.000Z', end: '2025-06-03T02:00:00.000Z' },
    ]);
  });
});

describe('getAvailableSlots — timezone offsets', () => {
  it('applies the winter (CET) offset for Belgrade', () => {
    // 2025-01-13 is a Monday; 09:00 CET == 08:00Z.
    expect(
      starts(
        build({
          date: '2025-01-13',
          options: { timezone: 'Europe/Belgrade', now: '2025-01-12T00:00:00.000Z' },
        }),
      ),
    ).toEqual(['2025-01-13T08:00:00.000Z', '2025-01-13T09:00:00.000Z', '2025-01-13T10:00:00.000Z']);
  });

  it('applies the summer (CEST) offset for Belgrade', () => {
    // 2025-07-14 is a Monday; 09:00 CEST == 07:00Z.
    expect(
      starts(
        build({
          date: '2025-07-14',
          options: { timezone: 'Europe/Belgrade', now: '2025-07-13T00:00:00.000Z' },
        }),
      ),
    ).toEqual(['2025-07-14T07:00:00.000Z', '2025-07-14T08:00:00.000Z', '2025-07-14T09:00:00.000Z']);
  });
});

describe('getAvailableSlots — determinism', () => {
  it('returns identical output for identical inputs', () => {
    const params = build({
      workingHours: [{ day: 1, start: '09:00', end: '17:00' }],
      existingBookings: [{ start: '2025-06-02T11:00:00.000Z', end: '2025-06-02T12:00:00.000Z' }],
      options: { timezone: 'Europe/Belgrade', now: EARLY_NOW, bufferMinutes: 15, leadMinutes: 30 },
    });
    expect(getAvailableSlots(params)).toEqual(getAvailableSlots(params));
  });
});

describe('getAvailableSlots — validation', () => {
  it('throws on a non-positive slotMinutes', () => {
    expect(() => getAvailableSlots(build({ slotMinutes: 0 }))).toThrow(RangeError);
    expect(() => getAvailableSlots(build({ slotMinutes: -30 }))).toThrow(RangeError);
  });

  it('throws on a malformed date', () => {
    expect(() => getAvailableSlots(build({ date: '2025/06/02' }))).toThrow(RangeError);
  });

  it('throws on a malformed working-hours time', () => {
    expect(() =>
      getAvailableSlots(build({ workingHours: [{ day: 1, start: '9:00', end: '17:00' }] })),
    ).toThrow(RangeError);
  });

  it('throws on an out-of-range time', () => {
    expect(() =>
      getAvailableSlots(build({ workingHours: [{ day: 1, start: '25:00', end: '26:00' }] })),
    ).toThrow(RangeError);
  });

  it('throws on an invalid booking instant', () => {
    expect(() =>
      getAvailableSlots(build({ existingBookings: [{ start: 'not-a-date', end: 'nope' }] })),
    ).toThrow(RangeError);
  });

  it('throws on an invalid timezone', () => {
    expect(() =>
      getAvailableSlots(build({ options: { timezone: 'Mars/Phobos', now: EARLY_NOW } })),
    ).toThrow(RangeError);
  });
});
