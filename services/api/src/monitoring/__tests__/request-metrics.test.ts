import { describe, expect, it } from '@jest/globals';
import { normalizeRoute } from '../request-metrics.js';

describe('normalizeRoute', () => {
  it('keeps static paths unchanged', () => {
    expect(normalizeRoute('/tutors')).toBe('/tutors');
    expect(normalizeRoute('/health')).toBe('/health');
  });

  it('collapses UUID segments to :id', () => {
    expect(normalizeRoute('/tutors/3f1c2e9a-0b2d-4c5e-8a6f-1234567890ab')).toBe('/tutors/:id');
  });

  it('collapses numeric segments to :id', () => {
    expect(normalizeRoute('/bookings/42/status')).toBe('/bookings/:id/status');
  });

  it('strips the query string', () => {
    expect(normalizeRoute('/tutors?subject=math&limit=10')).toBe('/tutors');
  });

  it('falls back to / for an empty path', () => {
    expect(normalizeRoute('')).toBe('/');
  });
});
