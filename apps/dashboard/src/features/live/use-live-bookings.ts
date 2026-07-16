import { useEffect } from 'react';
import { api } from '../../store/api';
import { useAppDispatch } from '../../store/hooks';
import { connectLiveSocket } from './socket';

/**
 * Subscribes to the API's Socket.IO gateway for the selected tutor and refreshes
 * the booking cache whenever a `bookingChanged` event arrives — so the calendar
 * and list update live without polling.
 */
export function useLiveBookings(tutorId: string | null): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (tutorId === null) return;

    const socket = connectLiveSocket();
    socket.on('connect', () => {
      socket.emit('subscribeTutor', { tutorId });
    });
    socket.on('bookingChanged', () => {
      dispatch(api.util.invalidateTags(['Booking', 'DashboardSummary', 'Notifications']));
    });

    return () => {
      socket.close();
    };
  }, [tutorId, dispatch]);
}
