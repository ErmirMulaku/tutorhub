import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../../env';
import { api } from '../../store/api';
import { useAppDispatch } from '../../store/hooks';

/**
 * Subscribes to the messaging gateway for the signed-in tutor and refreshes the
 * conversation/message cache (and the unread badge) when a `messageReceived`
 * event arrives — so new messages appear live without polling.
 */
export function useLiveMessages(tutorId: string | null): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (tutorId === null) return;

    const socket = io(API_URL, { transports: ['websocket'] });
    socket.on('connect', () => {
      socket.emit('subscribeMessages', { tutorId });
    });
    socket.on('messageReceived', () => {
      dispatch(
        api.util.invalidateTags(['Message', 'Conversation', 'DashboardSummary', 'Notifications']),
      );
    });

    return () => {
      socket.close();
    };
  }, [tutorId, dispatch]);
}
