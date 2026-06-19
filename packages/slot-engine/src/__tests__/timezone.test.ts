import { describe, expect, it } from '@jest/globals';
import { getOffsetMs, zonedWallTimeToUtcMs } from '../timezone.js';

const HOUR = 3_600_000;

describe('getOffsetMs', () => {
  it('returns 0 for UTC at any instant', () => {
    expect(getOffsetMs('UTC', Date.UTC(2025, 0, 1))).toBe(0);
    expect(getOffsetMs('UTC', Date.UTC(2025, 6, 1))).toBe(0);
  });

  it('returns the standard-time offset in winter', () => {
    // Europe/Belgrade is CET (UTC+1) in January.
    expect(getOffsetMs('Europe/Belgrade', Date.UTC(2025, 0, 15))).toBe(1 * HOUR);
  });

  it('returns the daylight-time offset in summer', () => {
    // Europe/Belgrade is CEST (UTC+2) in July.
    expect(getOffsetMs('Europe/Belgrade', Date.UTC(2025, 6, 15))).toBe(2 * HOUR);
  });

  it('handles negative (west-of-UTC) offsets and their DST shift', () => {
    // America/New_York: EST (UTC-5) in winter, EDT (UTC-4) in summer.
    expect(getOffsetMs('America/New_York', Date.UTC(2025, 0, 15, 12))).toBe(-5 * HOUR);
    expect(getOffsetMs('America/New_York', Date.UTC(2025, 6, 15, 12))).toBe(-4 * HOUR);
  });
});

describe('zonedWallTimeToUtcMs', () => {
  it('maps a UTC wall time to itself', () => {
    expect(zonedWallTimeToUtcMs('UTC', 2025, 6, 1, 12, 0)).toBe(Date.UTC(2025, 5, 1, 12, 0));
  });

  it('applies the winter offset (Belgrade 09:00 CET → 08:00Z)', () => {
    expect(zonedWallTimeToUtcMs('Europe/Belgrade', 2025, 1, 15, 9, 0)).toBe(
      Date.UTC(2025, 0, 15, 8, 0),
    );
  });

  it('applies the summer offset (Belgrade 09:00 CEST → 07:00Z)', () => {
    expect(zonedWallTimeToUtcMs('Europe/Belgrade', 2025, 7, 15, 9, 0)).toBe(
      Date.UTC(2025, 6, 15, 7, 0),
    );
  });

  it('resolves the spring-forward start boundary (01:00 CET → 00:00Z)', () => {
    // 2025-03-30 02:00 CET jumps to 03:00 CEST; 01:00 is still CET (+1).
    expect(zonedWallTimeToUtcMs('Europe/Belgrade', 2025, 3, 30, 1, 0)).toBe(
      Date.UTC(2025, 2, 30, 0, 0),
    );
  });

  it('is deterministic for an ambiguous fall-back wall time', () => {
    // 2025-10-26 the 02:30 wall time occurs twice; the result must be stable
    // and land on one of the two valid instants (01:00Z or 02:00Z).
    const first = zonedWallTimeToUtcMs('Europe/Belgrade', 2025, 10, 26, 2, 30);
    const second = zonedWallTimeToUtcMs('Europe/Belgrade', 2025, 10, 26, 2, 30);
    expect(first).toBe(second);
    expect([Date.UTC(2025, 9, 26, 0, 30), Date.UTC(2025, 9, 26, 1, 30)]).toContain(first);
  });
});
