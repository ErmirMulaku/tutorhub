import type { JSX } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { BookingStatus } from '@ermulaku/types';
import { useGetBookingsQuery, useUpdateBookingStatusMutation } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Allowed next statuses (mirrors the API BookingService state machine). */
const NEXT_STATUSES: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.Pending]: [BookingStatus.Confirmed, BookingStatus.Cancelled],
  [BookingStatus.Confirmed]: [
    BookingStatus.Completed,
    BookingStatus.Cancelled,
    BookingStatus.NoShow,
  ],
  [BookingStatus.Completed]: [],
  [BookingStatus.Cancelled]: [],
  [BookingStatus.NoShow]: [],
};

const ACTION_LABEL: Record<BookingStatus, string> = {
  [BookingStatus.Pending]: 'Pending',
  [BookingStatus.Confirmed]: 'Confirm',
  [BookingStatus.Completed]: 'Complete',
  [BookingStatus.Cancelled]: 'Cancel',
  [BookingStatus.NoShow]: 'No-show',
};

export function BookingsList(): JSX.Element {
  const tutorId = useAppSelector((state) => state.ui.selectedTutorId);
  const { data: bookings, isFetching } = useGetBookingsQuery(tutorId ? { tutorId } : skipToken);
  const [updateStatus, { isLoading }] = useUpdateBookingStatusMutation();

  if (tutorId === null) return <p className="muted">Select a tutor to see their bookings.</p>;
  if (isFetching && bookings === undefined) return <p>Loading bookings…</p>;
  if (bookings === undefined || bookings.length === 0) return <p className="muted">No bookings.</p>;

  return (
    <table className="bookings">
      <thead>
        <tr>
          <th>Start</th>
          <th>End</th>
          <th>Status</th>
          <th>Actions</th>
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
            <td className="bookings__actions">
              {NEXT_STATUSES[booking.status].map((next) => (
                <button
                  key={next}
                  type="button"
                  className="btn btn--sm"
                  disabled={isLoading}
                  onClick={() => {
                    void updateStatus({ id: booking.id, status: next });
                  }}
                >
                  {ACTION_LABEL[next]}
                </button>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
