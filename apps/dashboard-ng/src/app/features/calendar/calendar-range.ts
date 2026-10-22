/**
 * Pure date maths for the calendar (ported from CalendarScreen.tsx). No
 * Angular here, so it can be unit-tested on its own. Dates are local time.
 *
 * One deliberate fix: React stepped days as `midnight + i × 24h`, which breaks
 * across a DST change (on the 25-hour fall-back day, every later "midnight"
 * lands at 23:00 of the previous date, so a month page shows that date twice).
 * `addDays` uses calendar arithmetic instead, which is DST-safe.
 */

export type CalendarView = 'day' | 'week' | 'month';

export const START_HOUR = 8;
export const END_HOUR = 20;
export const ROW_H = 54;

/** `d` plus `n` calendar days, keeping the local time of day (DST-safe). */
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** The Monday on or before `d` (weeks start on Monday). */
export function mondayOf(d: Date): Date {
  const day = startOfDay(d);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

export interface CalendarRange {
  /** First and (exclusive) last instant of the visible period. */
  start: Date;
  end: Date;
  /** First day drawn in the grid (a month page starts on a Monday). */
  gridStart: Date;
  columns: number;
  /** What to fetch: a month fetches its whole 6-week page so edge days show events too. */
  fetchFrom: Date;
  fetchTo: Date;
}

/** The visible window for the current view, plus the columns it renders. */
export function rangeFor(view: CalendarView, anchor: Date): CalendarRange {
  if (view === 'day') {
    const start = startOfDay(anchor);
    const end = addDays(start, 1);
    return { start, end, gridStart: start, columns: 1, fetchFrom: start, fetchTo: end };
  }
  if (view === 'week') {
    const start = mondayOf(anchor);
    const end = addDays(start, 7);
    return { start, end, gridStart: start, columns: 7, fetchFrom: start, fetchTo: end };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  const gridStart = mondayOf(start);
  return {
    start,
    end,
    gridStart,
    columns: 7,
    fetchFrom: gridStart,
    fetchTo: addDays(gridStart, 42),
  };
}

/** One step back/forward: a day, a week or a month. */
export function stepAnchor(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  const next = new Date(anchor);
  if (view === 'day') next.setDate(next.getDate() + dir);
  else if (view === 'week') next.setDate(next.getDate() + dir * 7);
  else next.setMonth(next.getMonth() + dir);
  return next;
}

/** The heading over the grid. */
export function rangeLabel(view: CalendarView, anchor: Date, range: CalendarRange): string {
  if (view === 'month') {
    return anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  if (view === 'day') {
    return startOfDay(anchor).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const from = range.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const to = addDays(range.end, -1).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${from} – ${to}`;
}

/** Pixel position of an event in the hour grid. */
export function eventBox(startIso: string, endIso: string): { top: number; height: number } {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const startMin = s.getHours() * 60 + s.getMinutes() - START_HOUR * 60;
  const durMin = (e.getTime() - s.getTime()) / 60000;
  return { top: (startMin / 60) * ROW_H, height: (durMin / 60) * ROW_H };
}

/** `count` consecutive days from `from`. */
export function daysFrom(from: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
