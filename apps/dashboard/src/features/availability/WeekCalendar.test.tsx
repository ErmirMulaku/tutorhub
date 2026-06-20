import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import type { Booking } from '@ermulaku/types';
import { WeekCalendar } from './WeekCalendar';

const booking: Booking = {
  id: 'b1',
  tutorId: 't1',
  studentId: 's1',
  subjectId: 'sub1',
  // Monday 09:00 UTC.
  startTime: '2025-06-02T09:00:00.000Z',
  endTime: '2025-06-02T10:00:00.000Z',
  status: 'PENDING',
  createdAt: '2025-06-01T00:00:00.000Z',
  updatedAt: '2025-06-01T00:00:00.000Z',
};

describe('WeekCalendar', () => {
  it('shades working hours and places a booking chip', () => {
    const { container } = render(
      <WeekCalendar
        workingHours={[{ day: 1, start: '09:00', end: '17:00' }]}
        bookings={[booking]}
        timezone="UTC"
      />,
    );

    // Monday 09:00–17:00 → 8 open cells.
    expect(container.querySelectorAll('.calendar__cell--open')).toHaveLength(8);
    // The PENDING booking renders one chip.
    const chips = container.querySelectorAll('.chip--pending');
    expect(chips).toHaveLength(1);
  });

  it('renders an empty grid when there are no working hours', () => {
    const { container } = render(<WeekCalendar workingHours={[]} bookings={[]} timezone="UTC" />);
    expect(container.querySelectorAll('.calendar__cell--open')).toHaveLength(0);
    expect(container.querySelectorAll('.chip')).toHaveLength(0);
  });
});
