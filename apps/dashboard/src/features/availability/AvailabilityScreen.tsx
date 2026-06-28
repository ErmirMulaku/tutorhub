import { type JSX, useEffect, useState } from 'react';
import { Button, Card, Skeleton } from '@ermulaku/ui';
import {
  type WorkingHour,
  useAddTimeOffMutation,
  useGetMyAvailabilityQuery,
  useRemoveTimeOffMutation,
  useUpdateBookingRulesMutation,
  useUpdateWorkingHoursMutation,
} from '../../store/api';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useToast } from '../../components/ToastProvider';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_WINDOW = { start: '09:00', end: '17:00' };

export function AvailabilityScreen(): JSX.Element {
  const { data, isLoading } = useGetMyAvailabilityQuery();
  const [saveHours, { isLoading: savingHours }] = useUpdateWorkingHoursMutation();
  const [saveRules, { isLoading: savingRules }] = useUpdateBookingRulesMutation();
  const [addTimeOff] = useAddTimeOffMutation();
  const [removeTimeOff] = useRemoveTimeOffMutation();
  const toast = useToast();

  // Local editable copies of working hours (one optional window per weekday).
  const [hours, setHours] = useState<Record<number, WorkingHour | null>>({});
  const [rules, setRules] = useState({ bufferMinutes: 15, minNoticeHours: 4, maxLessonsPerDay: 6 });
  const [off, setOff] = useState({ label: '', startDate: '', endDate: '' });

  useEffect(() => {
    if (!data) return;
    const map: Record<number, WorkingHour | null> = {};
    for (let d = 0; d < 7; d++) map[d] = data.workingHours.find((w) => w.day === d) ?? null;
    setHours(map);
    setRules({
      bufferMinutes: data.bufferMinutes,
      minNoticeHours: data.minNoticeHours,
      maxLessonsPerDay: data.maxLessonsPerDay,
    });
  }, [data]);

  function toggleDay(day: number, on: boolean): void {
    setHours((prev) => ({ ...prev, [day]: on ? { day, ...DEFAULT_WINDOW } : null }));
  }
  function setTime(day: number, field: 'start' | 'end', value: string): void {
    setHours((prev) => {
      const cur = prev[day];
      return cur ? { ...prev, [day]: { ...cur, [field]: value } } : prev;
    });
  }

  function onSaveHours(): void {
    const list = Object.values(hours).filter((h): h is WorkingHour => h !== null);
    void saveHours(list)
      .unwrap()
      .then(() => toast('Availability saved'));
  }
  function onSaveRules(): void {
    void saveRules(rules)
      .unwrap()
      .then(() => toast('Booking rules saved'));
  }
  function onAddTimeOff(): void {
    if (!off.label || !off.startDate || !off.endDate) return;
    void addTimeOff({
      label: off.label,
      startDate: new Date(off.startDate).toISOString(),
      endDate: new Date(off.endDate).toISOString(),
    })
      .unwrap()
      .then(() => {
        toast('Time off added');
        setOff({ label: '', startDate: '', endDate: '' });
      });
  }

  if (isLoading || !data) return <Skeleton height={320} />;

  return (
    <div className="avail">
      <Card>
        <h3 className="card-head__title">Weekly hours</h3>
        <div className="avail__days">
          {DAYS.map((name, day) => {
            const win = hours[day] ?? null;
            return (
              <div key={day} className="avail__day">
                <ToggleSwitch checked={win !== null} onChange={(on) => toggleDay(day, on)} label={name} />
                <span className="avail__day-name">{name}</span>
                {win ? (
                  <span className="avail__range">
                    <input type="time" value={win.start} onChange={(e) => setTime(day, 'start', e.target.value)} />
                    <span className="muted">–</span>
                    <input type="time" value={win.end} onChange={(e) => setTime(day, 'end', e.target.value)} />
                  </span>
                ) : (
                  <span className="muted">Unavailable</span>
                )}
              </div>
            );
          })}
        </div>
        <Button size="sm" onClick={onSaveHours} disabled={savingHours}>
          {savingHours ? 'Saving…' : 'Save availability'}
        </Button>
      </Card>

      <div className="avail__rail">
        <Card>
          <h3 className="card-head__title">Booking rules</h3>
          <div className="avail__rules">
            <label className="login__field">
              <span>Buffer between lessons (min)</span>
              <input
                type="number"
                min={0}
                value={rules.bufferMinutes}
                onChange={(e) => setRules({ ...rules, bufferMinutes: Number(e.target.value) })}
              />
            </label>
            <label className="login__field">
              <span>Minimum notice (hours)</span>
              <input
                type="number"
                min={0}
                value={rules.minNoticeHours}
                onChange={(e) => setRules({ ...rules, minNoticeHours: Number(e.target.value) })}
              />
            </label>
            <label className="login__field">
              <span>Max lessons per day</span>
              <input
                type="number"
                min={1}
                value={rules.maxLessonsPerDay}
                onChange={(e) => setRules({ ...rules, maxLessonsPerDay: Number(e.target.value) })}
              />
            </label>
          </div>
          <Button size="sm" onClick={onSaveRules} disabled={savingRules}>
            Save rules
          </Button>
        </Card>

        <Card>
          <h3 className="card-head__title">Time off</h3>
          {data.timeOff.length === 0 && <p className="muted">No time off scheduled.</p>}
          {data.timeOff.map((t) => (
            <div key={t.id} className="avail__off-row">
              <span>{t.label}</span>
              <span className="muted">
                {new Date(t.startDate).toLocaleDateString('en-GB')} –{' '}
                {new Date(t.endDate).toLocaleDateString('en-GB')}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void removeTimeOff(t.id)}>
                Remove
              </Button>
            </div>
          ))}
          <div className="avail__off-add">
            <input
              placeholder="🏖 Holiday"
              value={off.label}
              onChange={(e) => setOff({ ...off, label: e.target.value })}
            />
            <input
              type="date"
              value={off.startDate}
              onChange={(e) => setOff({ ...off, startDate: e.target.value })}
            />
            <input
              type="date"
              value={off.endDate}
              onChange={(e) => setOff({ ...off, endDate: e.target.value })}
            />
            <Button size="sm" variant="secondary" onClick={onAddTimeOff}>
              Add
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
