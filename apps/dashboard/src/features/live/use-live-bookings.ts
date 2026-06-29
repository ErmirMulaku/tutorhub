import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../../env';
import { api } from '../../store/api';
import { useAppDispatch } from '../../store/hooks';

/**
 * Subscribes to the API's Socket.IO gateway for the selected tutor and refreshes
 * the booking cache whenever a `bookingChanged` event arrives — so the calendar
 * and list update live without polling.
 */
export function useLiveBookings(tutorId: string | null): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (tutorId === null) return;

    const socket = io(API_URL, { transports: ['websocket'] });
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
