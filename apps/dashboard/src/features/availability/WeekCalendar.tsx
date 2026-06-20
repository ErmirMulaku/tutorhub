import { Fragment, type JSX } from 'react';
import type { Booking, WorkingHours } from '@ermulaku/types';
import { END_HOUR, START_HOUR, WEEK_DAYS, isWorkingHour } from './days';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** A booking's weekday + hour in the tutor's timezone (where its windows live). */
function localCell(iso: string, timeZone: string): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  return { day: WEEKDAY_INDEX[weekday] ?? 0, hour };
}

export function WeekCalendar({
  workingHours,
  bookings,
  timezone,
}: {
  workingHours: WorkingHours[];
  bookings: Booking[];
  timezone: string;
}): JSX.Element {
  const hours: number[] = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour += 1) hours.push(hour);

  const byCell = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const { day, hour } = localCell(booking.startTime, timezone);
    const key = `${day.toString()}-${hour.toString()}`;
    byCell.set(key, [...(byCell.get(key) ?? []), booking]);
  }

  return (
    <div
      className="calendar"
      style={{ gridTemplateColumns: `52px repeat(${WEEK_DAYS.length.toString()}, 1fr)` }}
    >
      <div className="calendar__corner" />
      {WEEK_DAYS.map(({ day, label }) => (
        <div key={day} className="calendar__head">
          {label}
        </div>
      ))}
      {hours.map((hour) => (
        <Fragment key={hour}>
          <div className="calendar__time">{hour.toString().padStart(2, '0')}:00</div>
          {WEEK_DAYS.map(({ day }) => {
            const cellBookings = byCell.get(`${day.toString()}-${hour.toString()}`) ?? [];
            const open = isWorkingHour(workingHours, day, hour);
            return (
              <div key={day} className={`calendar__cell${open ? ' calendar__cell--open' : ''}`}>
                {cellBookings.map((booking) => (
                  <span
                    key={booking.id}
                    className={`chip chip--${booking.status.toLowerCase()}`}
                    title={booking.status}
                  />
                ))}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
