import { TutorHubClient } from '@ermulaku/api-client';

/**
 * Where the app talks to the API. `localhost` works for the web target and an
 * iOS simulator; on a physical device, point this at your machine's LAN IP.
 */
export const API_URL = 'http://localhost:4000';

/** The seeded student the app books as (no end-user auth yet). */
export const DEMO_EMAIL = 'sara@example.com';

export const api = new TutorHubClient({ baseUrl: API_URL });

/** First upcoming weekday (Mon–Fri) as `YYYY-MM-DD`, where tutors work. */
export function nextWeekday(): string {
  const now = new Date();
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) return d.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}

/** Wall-clock time of an instant in a timezone, e.g. "09:00". */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}
