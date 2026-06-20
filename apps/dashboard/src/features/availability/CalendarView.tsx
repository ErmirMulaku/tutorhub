import type { JSX } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetBookingsQuery, useGetTutorsQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';
import { WeekCalendar } from './WeekCalendar';
import { WorkingHoursEditor } from './WorkingHoursEditor';

export function CalendarView(): JSX.Element {
  const tutorId = useAppSelector((state) => state.ui.selectedTutorId);
  const { data: tutors } = useGetTutorsQuery();
  const { data: bookings } = useGetBookingsQuery(tutorId ? { tutorId } : skipToken);

  if (tutorId === null) {
    return <p className="muted">Select a tutor to manage availability.</p>;
  }
  const tutor = tutors?.find((candidate) => candidate.id === tutorId);
  if (tutor === undefined) return <p>Loading…</p>;

  return (
    <div className="availability">
      <section className="panel">
        <h2>Working hours · {tutor.timezone}</h2>
        <WorkingHoursEditor tutorId={tutor.id} workingHours={tutor.workingHours} />
      </section>
      <section className="panel">
        <h2>Week</h2>
        <WeekCalendar
          workingHours={tutor.workingHours}
          bookings={bookings ?? []}
          timezone={tutor.timezone}
        />
      </section>
    </div>
  );
}
