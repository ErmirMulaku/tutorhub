import type { WorkingHours } from '@ermulaku/types';

/** Display order Monday→Sunday; values are `Date#getUTCDay` indices. */
export const WEEK_DAYS: ReadonlyArray<{ day: number; label: string }> = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

/** First calendar hour and (exclusive) last hour shown in the week grid. */
export const START_HOUR = 8;
export const END_HOUR = 20;

export function hourOf(time: string): number {
  return Number(time.slice(0, 2));
}

export function minuteOf(time: string): number {
  return Number(time.slice(3, 5));
}

/** Whether `hour` falls inside any working window for `day` (non-crossing). */
export function isWorkingHour(workingHours: WorkingHours[], day: number, hour: number): boolean {
  return workingHours.some(
    (window) => window.day === day && hour >= hourOf(window.start) && hour < hourOf(window.end),
  );
}
