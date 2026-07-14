import { type JSX, useEffect, useState } from 'react';
import { Button, Skeleton } from '@ermulaku/ui';
import {
  type WorkingHour,
  useGetMyAvailabilityQuery,
  useUpdateWorkingHoursMutation,
} from '../../store/api';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useToast } from '../../components/ToastProvider';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_WINDOW = { start: '09:00', end: '17:00' };

/**
 * The weekly working-hours editor — a toggle + time window per weekday, with a
 * save button. Shared by the Availability screen and the onboarding wizard so
 * both edit hours the exact same way. Saving invalidates the `Availability`
 * tag, so every `useGetMyAvailabilityQuery` consumer refetches.
 */
export function WeeklyHoursEditor(): JSX.Element {
  const { data, isLoading } = useGetMyAvailabilityQuery();
  const [saveHours, { isLoading: savingHours }] = useUpdateWorkingHoursMutation();
  const toast = useToast();

  const [hours, setHours] = useState<Record<number, WorkingHour | null>>({});

  useEffect(() => {
    if (!data) return;
    const map: Record<number, WorkingHour | null> = {};
    for (let d = 0; d < 7; d++) map[d] = data.workingHours.find((w) => w.day === d) ?? null;
    setHours(map);
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

  if (isLoading || !data) return <Skeleton height={280} />;

  return (
    <>
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
    </>
  );
}
