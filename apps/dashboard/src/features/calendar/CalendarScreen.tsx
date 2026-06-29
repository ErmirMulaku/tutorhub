import { type JSX, useMemo, useState } from 'react';
import { Button, Card } from '@ermulaku/ui';
import { type TutorBooking, useGetTutorBookingsQuery } from '../../store/api';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { timeOf } from '../../lib/format';

type View = 'day' | 'week' | 'month';

const START_HOUR = 8;
const END_HOUR = 20;
const ROW_H = 54;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function mondayOf(d: Date): Date {
  const day = startOfDay(d);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7)); // 0 = Monday
  return day;
}

/** The visible window for the current view, plus the columns it renders. */
function rangeFor(view: View, anchor: Date): { start: Date; end: Date; gridStart: Date; columns: number } {
  if (view === 'day') {
    const start = startOfDay(anchor);
    return { start, end: new Date(start.getTime() + DAY_MS), gridStart: start, columns: 1 };
  }
  if (view === 'week') {
    const start = mondayOf(anchor);
    return { start, end: new Date(start.getTime() + 7 * DAY_MS), gridStart: start, columns: 7 };
  }
  // month: data window is the calendar month; the grid is a 6-week (42-day) page.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  return { start: first, end, gridStart: mondayOf(first), columns: 7 };
}

export function CalendarScreen(): JSX.Element {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const { start, end, gridStart, columns } = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  // Month fetches the whole 6-week page so trailing/leading days show events too.
  const fetchStart = view === 'month' ? gridStart : start;
  const fetchEnd =
    view === 'month' ? new Date(gridStart.getTime() + 42 * DAY_MS) : end;
  const { data: bookings } = useGetTutorBookingsQuery({
    from: fetchStart.toISOString(),
    to: fetchEnd.toISOString(),
  });

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const todayKey = new Date().toDateString();
  const events = (bookings ?? []).filter((b) => b.status !== 'CANCELLED');

  function step(dir: -1 | 1): void {
    const next = new Date(anchor);
    if (view === 'day') next.setDate(next.getDate() + dir);
    else if (view === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  function pos(b: TutorBooking): { top: number; height: number } {
    const s = new Date(b.startTime);
    const e = new Date(b.endTime);
    const startMin = s.getHours() * 60 + s.getMinutes() - START_HOUR * 60;
    const durMin = (e.getTime() - s.getTime()) / 60000;
    return { top: (startMin / 60) * ROW_H, height: (durMin / 60) * ROW_H };
  }

  const label =
    view === 'month'
      ? anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : view === 'day'
        ? startOfDay(anchor).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(
            end.getTime() - DAY_MS,
          ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const cols = Array.from({ length: columns }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS));

  return (
    <Card className="cal">
      <div className="cal__toolbar">
        <div className="cal__nav">
          <Button size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <button type="button" className="cal__chevron" aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
          <button type="button" className="cal__chevron" aria-label="Next" onClick={() => step(1)}>
            ›
          </button>
          <h3>{label}</h3>
        </div>
        <div className="cal__toolbar-right">
          <div className="cal__legend">
            <span className="cal__legend-item cal__legend-item--mathematics">Mathematics</span>
            <span className="cal__legend-item cal__legend-item--physics">Physics</span>
          </div>
          <SegmentedTabs<View>
            segments={[
              { key: 'day', label: 'Day' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid gridStart={gridStart} month={anchor.getMonth()} events={events} onPick={(d) => { setAnchor(d); setView('day'); }} />
      ) : (
        <div
          className="cal__grid"
          style={{
            ['--row-h' as string]: `${String(ROW_H)}px`,
            gridTemplateColumns: `58px repeat(${String(columns)}, 1fr)`,
          }}
        >
          <div className="cal__corner" />
          {cols.map((d) => (
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

          {cols.map((d) => {
            const dayEvents = events.filter(
              (b) => new Date(b.startTime).toDateString() === d.toDateString(),
            );
            return (
              <div
                key={d.toISOString()}
                className={`cal__col${d.toDateString() === todayKey ? ' cal__col--today' : ''}`}
                style={{ height: hours.length * ROW_H }}
              >
                {dayEvents.map((b) => {
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
            );
          })}
        </div>
      )}
    </Card>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MonthGrid({
  gridStart,
  month,
  events,
  onPick,
}: {
  gridStart: Date;
  month: number;
  events: TutorBooking[];
  onPick: (d: Date) => void;
}): JSX.Element {
  const todayKey = new Date().toDateString();
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS));
  return (
    <div className="cal-month">
      <div className="cal-month__head">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="cal-month__grid">
        {cells.map((d) => {
          const dayEvents = events.filter(
            (b) => new Date(b.startTime).toDateString() === d.toDateString(),
          );
          return (
            <button
              type="button"
              key={d.toISOString()}
              className={`cal-month__cell${d.getMonth() !== month ? ' cal-month__cell--muted' : ''}${
                d.toDateString() === todayKey ? ' cal-month__cell--today' : ''
              }`}
              onClick={() => onPick(d)}
            >
              <span className="cal-month__date">{d.getDate()}</span>
              {dayEvents.slice(0, 3).map((b) => (
                <span
                  key={b.id}
                  className={`cal-month__chip cal-month__chip--${b.subject.name.toLowerCase()}`}
                >
                  {timeOf(b.startTime)} {b.subject.name}
                </span>
              ))}
              {dayEvents.length > 3 && (
                <span className="cal-month__more">+{dayEvents.length - 3} more</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
