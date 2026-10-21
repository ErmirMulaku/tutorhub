import { addDays, daysFrom, eventBox, mondayOf, rangeFor, stepAnchor } from './calendar-range';

describe('calendar-range', () => {
  describe('daysFrom / addDays (DST)', () => {
    it('yields 42 distinct, consecutive calendar dates across the October DST change', () => {
      // The October 2026 month page: Mon 28 Sep → Sun 8 Nov, crossing the
      // 25 Oct fall-back in Europe. React's `midnight + i × 24h` repeated 25 Oct.
      const days = daysFrom(new Date(2026, 8, 28), 42);
      const labels = days.map((d) => d.toDateString());

      expect(new Set(labels).size).toBe(42);
      expect(days.every((d) => d.getHours() === 0)).toBeTrue();
      expect(days[27]?.toDateString()).toBe(new Date(2026, 9, 25).toDateString());
      expect(days[28]?.toDateString()).toBe(new Date(2026, 9, 26).toDateString());
    });

    it('keeps the local time of day when adding days', () => {
      const nineAm = new Date(2026, 9, 24, 9, 0);
      expect(addDays(nineAm, 2).getHours()).toBe(9);
    });
  });

  it('starts weeks on Monday', () => {
    // Wednesday 21 Oct 2026 → Monday 19 Oct.
    expect(mondayOf(new Date(2026, 9, 21, 15, 30)).toDateString()).toBe(
      new Date(2026, 9, 19).toDateString(),
    );
    // A Sunday belongs to the week that started six days earlier.
    expect(mondayOf(new Date(2026, 9, 25)).toDateString()).toBe(
      new Date(2026, 9, 19).toDateString(),
    );
  });

  describe('rangeFor', () => {
    const anchor = new Date(2026, 9, 21, 15, 30);

    it('day: one column, midnight to midnight', () => {
      const r = rangeFor('day', anchor);
      expect(r.columns).toBe(1);
      expect(r.start).toEqual(new Date(2026, 9, 21));
      expect(r.end).toEqual(new Date(2026, 9, 22));
    });

    it('week: seven columns, ending at the next Monday midnight even across DST', () => {
      const r = rangeFor('week', anchor);
      expect(r.columns).toBe(7);
      expect(r.start).toEqual(new Date(2026, 9, 19));
      expect(r.end).toEqual(new Date(2026, 9, 26));
    });

    it('month: shows the calendar month but fetches the whole 6-week page', () => {
      const r = rangeFor('month', anchor);
      expect(r.start).toEqual(new Date(2026, 9, 1));
      expect(r.end).toEqual(new Date(2026, 10, 1));
      expect(r.gridStart).toEqual(new Date(2026, 8, 28));
      expect(r.fetchFrom).toEqual(r.gridStart);
      expect(r.fetchTo).toEqual(new Date(2026, 10, 9));
    });
  });

  it('steps by a day, a week or a month', () => {
    const a = new Date(2026, 0, 31);
    expect(stepAnchor('day', a, 1).toDateString()).toBe(new Date(2026, 1, 1).toDateString());
    expect(stepAnchor('week', a, -1).toDateString()).toBe(new Date(2026, 0, 24).toDateString());
    expect(stepAnchor('month', new Date(2026, 4, 15), 1).getMonth()).toBe(5);
  });

  it('positions an event in the 08:00-based hour grid (54px rows)', () => {
    const start = new Date(2026, 9, 21, 9, 30).toISOString();
    const end = new Date(2026, 9, 21, 10, 30).toISOString();
    expect(eventBox(start, end)).toEqual({ top: 81, height: 54 });
  });
});
