import { type JSX, useEffect, useState } from 'react';
import type { WorkingHours } from '@ermulaku/types';
import { useUpdateTutorHoursMutation } from '../../store/api';
import { WEEK_DAYS } from './days';

interface DayRow {
  day: number;
  label: string;
  open: boolean;
  start: string;
  end: string;
}

function buildRows(workingHours: WorkingHours[]): DayRow[] {
  return WEEK_DAYS.map(({ day, label }) => {
    const window = workingHours.find((w) => w.day === day);
    return window
      ? { day, label, open: true, start: window.start, end: window.end }
      : { day, label, open: false, start: '09:00', end: '17:00' };
  });
}

export function WorkingHoursEditor({
  tutorId,
  workingHours,
}: {
  tutorId: string;
  workingHours: WorkingHours[];
}): JSX.Element {
  const [rows, setRows] = useState<DayRow[]>(() => buildRows(workingHours));
  useEffect(() => {
    setRows(buildRows(workingHours));
  }, [workingHours]);

  const [save, { isLoading }] = useUpdateTutorHoursMutation();

  const update = (day: number, patch: Partial<DayRow>): void => {
    setRows((prev) => prev.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  };

  const onSave = (): void => {
    const next: WorkingHours[] = rows
      .filter((row) => row.open)
      .map((row) => ({ day: row.day, start: row.start, end: row.end }));
    void save({ id: tutorId, workingHours: next });
  };

  return (
    <div className="hours-editor">
      {rows.map((row) => (
        <div key={row.day} className="hours-editor__row">
          <label className="hours-editor__day">
            <input
              type="checkbox"
              checked={row.open}
              onChange={(e) => {
                update(row.day, { open: e.target.checked });
              }}
            />
            {row.label}
          </label>
          <input
            type="time"
            value={row.start}
            disabled={!row.open}
            onChange={(e) => {
              update(row.day, { start: e.target.value });
            }}
          />
          <span>–</span>
          <input
            type="time"
            value={row.end}
            disabled={!row.open}
            onChange={(e) => {
              update(row.day, { end: e.target.value });
            }}
          />
        </div>
      ))}
      <button type="button" className="btn" onClick={onSave} disabled={isLoading}>
        {isLoading ? 'Saving…' : 'Save hours'}
      </button>
    </div>
  );
}
