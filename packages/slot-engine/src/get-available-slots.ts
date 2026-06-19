import { zonedWallTimeToUtcMs } from './timezone.js';
import type { GetAvailableSlotsParams, Slot, WorkingWindow } from './types.js';

const MS_PER_MINUTE = 60_000;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface Interval {
  startMs: number;
  endMs: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

function parseDate(date: string): CalendarDate {
  const match = DATE_RE.exec(date);
  if (match === null) {
    throw new RangeError(`Invalid date "${date}", expected "YYYY-MM-DD".`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTime(time: string): { hours: number; minutes: number } {
  const match = TIME_RE.exec(time);
  if (match === null) {
    throw new RangeError(`Invalid time "${time}", expected "HH:mm".`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new RangeError(`Invalid time "${time}", out of range.`);
  }
  return { hours, minutes };
}

/** Add `days` calendar days to a date, rolling months/years over safely. */
function addDays(date: CalendarDate, days: number): CalendarDate {
  const rolled = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: rolled.getUTCFullYear(),
    month: rolled.getUTCMonth() + 1,
    day: rolled.getUTCDate(),
  };
}

function minutesOfDay(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

function isoToMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO date-time "${iso}".`);
  }
  return ms;
}

/**
 * Resolve a {@link WorkingWindow} anchored to `date` into an absolute UTC
 * interval. A window whose end is `<=` its start crosses midnight and ends on
 * the following calendar day. The interval's real duration automatically
 * accounts for DST (a lost hour shortens it; a gained hour lengthens it).
 */
function windowToInterval(timeZone: string, date: CalendarDate, window: WorkingWindow): Interval {
  const start = parseTime(window.start);
  const end = parseTime(window.end);
  const crossesMidnight =
    minutesOfDay(end.hours, end.minutes) <= minutesOfDay(start.hours, start.minutes);
  const endDate = crossesMidnight ? addDays(date, 1) : date;

  return {
    startMs: zonedWallTimeToUtcMs(
      timeZone,
      date.year,
      date.month,
      date.day,
      start.hours,
      start.minutes,
    ),
    endMs: zonedWallTimeToUtcMs(
      timeZone,
      endDate.year,
      endDate.month,
      endDate.day,
      end.hours,
      end.minutes,
    ),
  };
}

function overlaps(slotStart: number, slotEnd: number, blocked: Interval): boolean {
  return slotStart < blocked.endMs && slotEnd > blocked.startMs;
}

/**
 * Compute the bookable slots for a tutor on a single calendar day.
 *
 * The engine is pure and deterministic: identical inputs (including
 * `options.now`) always yield identical output. All reasoning happens in
 * absolute UTC milliseconds, so timezone and DST behaviour is correct by
 * construction.
 *
 * Slots are a fixed grid stepped from each working window's start (so slot
 * times stay predictable), filtered to those that:
 * - fit entirely within the window,
 * - start no earlier than `now + leadMinutes`,
 * - do not overlap any booking expanded by `bufferMinutes`,
 * - do not overlap any break.
 *
 * Windows are attributed to the calendar day they **start** on; a midnight-
 * crossing window contributes all of its slots to that day.
 *
 * @returns slots sorted ascending by start; `[]` when nothing is available.
 * @throws {RangeError} on a non-positive `slotMinutes`, a malformed
 *   date/time/ISO input, or an invalid `options.timezone`.
 */
export function getAvailableSlots(params: GetAvailableSlotsParams): Slot[] {
  const { workingHours, existingBookings, slotMinutes, date, options } = params;

  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
    throw new RangeError(`slotMinutes must be a positive number, got ${slotMinutes}.`);
  }

  const { timezone } = options;
  const bufferMs = (options.bufferMinutes ?? 0) * MS_PER_MINUTE;
  const leadMs = (options.leadMinutes ?? 0) * MS_PER_MINUTE;
  const breaks = options.breaks ?? [];
  const nowMs = options.now !== undefined ? isoToMs(options.now) : Date.now();
  const earliestStartMs = nowMs + leadMs;
  const slotMs = slotMinutes * MS_PER_MINUTE;

  const calendarDate = parseDate(date);
  const dayOfWeek = new Date(
    Date.UTC(calendarDate.year, calendarDate.month - 1, calendarDate.day),
  ).getUTCDay();

  // Everything that blocks a slot, as absolute UTC intervals.
  const blocked: Interval[] = [];
  for (const booking of existingBookings) {
    blocked.push({
      startMs: isoToMs(booking.start) - bufferMs,
      endMs: isoToMs(booking.end) + bufferMs,
    });
  }
  for (const breakWindow of breaks) {
    if (breakWindow.day !== dayOfWeek) {
      continue;
    }
    blocked.push(windowToInterval(timezone, calendarDate, breakWindow));
  }

  const slots: Slot[] = [];
  for (const window of workingHours) {
    if (window.day !== dayOfWeek) {
      continue;
    }
    const { startMs, endMs } = windowToInterval(timezone, calendarDate, window);
    for (let start = startMs; start + slotMs <= endMs; start += slotMs) {
      const end = start + slotMs;
      if (start < earliestStartMs) {
        continue;
      }
      if (blocked.some((interval) => overlaps(start, end, interval))) {
        continue;
      }
      slots.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
    }
  }

  slots.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return slots;
}
