import { describe, expect, it } from '@jest/globals';
import { startOfDayInZone, startOfWeekInZone } from '../zoned-dates.js';

describe('zoned-dates', () => {
  // 2026-06-28 22:00 in Berlin (UTC+2 in summer) — a Sunday.
  const now = new Date('2026-06-28T20:00:00.000Z');

  it('startOfDayInZone returns local midnight as a UTC instant', () => {
    // Berlin midnight on 2026-06-28 is 22:00 UTC on 2026-06-27.
    expect(startOfDayInZone(now, 'Europe/Berlin').toISOString()).toBe('2026-06-27T22:00:00.000Z');
  });

  it('startOfWeekInZone returns Monday 00:00 local', () => {
    // ISO week containing Sun 2026-06-28 starts Mon 2026-06-22 (00:00 Berlin = 22:00 UTC Sun 21).
    expect(startOfWeekInZone(now, 'Europe/Berlin').toISOString()).toBe('2026-06-21T22:00:00.000Z');
  });

  it('handles a UTC zone', () => {
    expect(startOfDayInZone(now, 'UTC').toISOString()).toBe('2026-06-28T00:00:00.000Z');
  });
});
