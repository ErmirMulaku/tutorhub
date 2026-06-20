import type { JSX } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetBookingsQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function BookingsList(): JSX.Element {
  const tutorId = useAppSelector((state) => state.ui.selectedTutorId);
  const { data: bookings, isFetching } = useGetBookingsQuery(tutorId ? { tutorId } : skipToken);

  if (tutorId === null) return <p className="muted">Select a tutor to see their bookings.</p>;
  if (isFetching) return <p>Loading bookings…</p>;
  if (bookings === undefined || bookings.length === 0) return <p className="muted">No bookings.</p>;

  return (
    <table className="bookings">
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((booking) => (
          <tr key={booking.id}>
            <td>{dateFormat.format(new Date(booking.startTime))}</td>
            <td>{dateFormat.format(new Date(booking.endTime))}</td>
            <td>
              <span className={`status status--${booking.status.toLowerCase()}`}>
                {booking.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
