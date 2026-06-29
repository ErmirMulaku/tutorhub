import { type JSX, useMemo, useState } from 'react';
import { Button, Card } from '@ermulaku/ui';
import { type TutorBooking, useGetTutorBookingsQuery } from '../../store/api';
import { timeOf } from '../../lib/format';

const START_HOUR = 8;
const END_HOUR = 20;
const ROW_H = 54;
const DAY_MS = 24 * 60 * 60 * 1000;

function mondayOf(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const dow = (day.getDay() + 6) % 7; // 0 = Monday
  day.setDate(day.getDate() - dow);
  return day;
}

export function CalendarScreen(): JSX.Element {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => {
    const m = mondayOf(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);
  const weekEnd = useMemo(() => new Date(weekStart.getTime() + 7 * DAY_MS), [weekStart]);
  const { data: bookings } = useGetTutorBookingsQuery({
    from: weekStart.toISOString(),
    to: weekEnd.toISOString(),
  });

  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const todayKey = new Date().toDateString();

  const eventsByDay: TutorBooking[][] = days.map(() => []);
  for (const b of bookings ?? []) {
    if (b.status === 'CANCELLED') continue;
    const idx = Math.floor((new Date(b.startTime).getTime() - weekStart.getTime()) / DAY_MS);
    if (idx >= 0 && idx < 7) eventsByDay[idx]?.push(b);
  }

  function pos(b: TutorBooking): { top: number; height: number } {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    const startMin = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60;
    const durMin = (end.getTime() - start.getTime()) / 60000;
    return { top: (startMin / 60) * ROW_H, height: (durMin / 60) * ROW_H };
  }

  return (
    <Card className="cal">
      <div className="cal__toolbar">
        <div className="cal__nav">
          <Button size="sm" variant="secondary" onClick={() => setWeekOffset(0)}>
            Today
          </Button>
          <button
            type="button"
            className="cal__chevron"
            aria-label="Previous week"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="cal__chevron"
            aria-label="Next week"
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            ›
          </button>
          <h3>
            {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
            {new Date(weekEnd.getTime() - DAY_MS).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </h3>
        </div>
        <div className="cal__legend">
          <span className="cal__legend-item cal__legend-item--mathematics">Mathematics</span>
          <span className="cal__legend-item cal__legend-item--physics">Physics</span>
        </div>
      </div>

      <div className="cal__grid" style={{ ['--row-h' as string]: `${String(ROW_H)}px` }}>
        <div className="cal__corner" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={`cal__head${d.toDateString() === todayKey ? ' cal__head--today' : ''}`}
          >
            <span>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
            <strong>{d.getDate()}</strong>
          </div>
        ))}

        <div className="cal__gutter">
          {hours.map((h) => (
            <div key={h} className="cal__hour" style={{ height: ROW_H }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {days.map((d, i) => (
          <div
            key={d.toISOString()}
            className={`cal__col${d.toDateString() === todayKey ? ' cal__col--today' : ''}`}
            style={{ height: hours.length * ROW_H }}
          >
            {eventsByDay[i]?.map((b) => {
              const { top, height } = pos(b);
              return (
                <div
                  key={b.id}
                  className={`cal__event cal__event--${b.subject.name.toLowerCase()}${
                    b.status === 'PENDING' ? ' cal__event--pending' : ''
                  }`}
                  style={{ top, height }}
                >
                  <div className="cal__event-subject">{b.subject.name}</div>
                  <div className="cal__event-meta">{b.student.fullName}</div>
                  <div className="cal__event-time">{timeOf(b.startTime)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
