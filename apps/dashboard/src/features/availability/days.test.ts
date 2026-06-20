import { describe, expect, it } from '@jest/globals';
import { hourOf, isWorkingHour, minuteOf } from './days';

describe('calendar helpers', () => {
  it('parses hours and minutes from "HH:mm"', () => {
    expect(hourOf('09:30')).toBe(9);
    expect(minuteOf('09:30')).toBe(30);
  });

  describe('isWorkingHour', () => {
    const workingHours = [{ day: 1, start: '09:00', end: '17:00' }];

    it('is true inside the window', () => {
      expect(isWorkingHour(workingHours, 1, 9)).toBe(true);
      expect(isWorkingHour(workingHours, 1, 16)).toBe(true);
    });

    it('is false at the exclusive end and outside the window', () => {
      expect(isWorkingHour(workingHours, 1, 17)).toBe(false);
      expect(isWorkingHour(workingHours, 1, 8)).toBe(false);
    });

    it('is false for a different day', () => {
      expect(isWorkingHour(workingHours, 2, 9)).toBe(false);
    });
  });
});
