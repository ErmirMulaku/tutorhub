/**
 * Date/time helpers for the booking UI. Pure and dependency-free (uses `Intl`),
 * so they run identically on the server and the client. Availability is
 * computed in the *tutor's* timezone, so slot times are formatted in that zone.
 */

/** `YYYY-MM-DD` for a Date, in UTC. */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The next `count` calendar days as `YYYY-MM-DD`, starting today (UTC). */
export function upcomingDates(count: number, from: Date = new Date()): string[] {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return toDateKey(d);
  });
}

/** Today's date key (UTC). */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** A short tab label for a `YYYY-MM-DD` day, e.g. "Mon 23". */
export function formatDayTab(dateKey: string, locale: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Wall-clock time of an instant in a given timezone, e.g. "09:00". */
export function formatSlotTime(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

/** A localised relative timestamp, e.g. "2h ago" / "3d ago", for notifications. */
export function relativeTime(iso: string, locale: string, now: Date = new Date()): string {
  const sec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(sec / 86400), 'day');
  if (abs < 31536000) return rtf.format(Math.round(sec / 2592000), 'month');
  return rtf.format(Math.round(sec / 31536000), 'year');
}

/** A full, human date-time of an instant in a timezone, for confirmations. */
export function formatFullDateTime(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}
