/**
 * Lightweight timezone-day math for dashboard KPIs (e.g. "lessons today",
 * "earnings this week") computed in the tutor's IANA zone. Built on `Intl` like
 * the slot-engine; `now` is injectable so the boundaries are deterministic in
 * tests. Day ranges are good-enough summary stats (not slot-precise).
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC offset of a zone at a given instant, in ms (UTC − zone wall clock). */
function zoneOffsetMs(at: Date, tz: string): number {
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(at.toLocaleString('en-US', { timeZone: tz }));
  return utc.getTime() - zoned.getTime();
}

/** The UTC instant of local midnight (start of `now`'s calendar day in `tz`). */
export function startOfDayInZone(now: Date, tz: string): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now); // YYYY-MM-DD
  return new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() + zoneOffsetMs(now, tz));
}

/** The UTC instant of the start of `now`'s ISO week (Monday) in `tz`. */
export function startOfWeekInZone(now: Date, tz: string): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const dow = new Date(`${ymd}T00:00:00.000Z`).getUTCDay(); // 0 = Sun … 6 = Sat
  const daysFromMonday = (dow + 6) % 7;
  return new Date(startOfDayInZone(now, tz).getTime() - daysFromMonday * DAY_MS);
}
