import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io } from 'socket.io-client';
import { environment } from '../../../environments/environment';

/** The slice of a socket.io client this app uses — small enough to fake in tests. */
export interface LiveSocket {
  on<T>(event: string, listener: (payload: T) => void): unknown;
  off<T>(event: string, listener: (payload: T) => void): unknown;
  emit(event: string, payload: unknown): unknown;
  close(): unknown;
}

/**
 * How a connection is opened. Port of features/live/socket.ts.
 *
 * Transports are `polling` first, then `websocket`: Socket.IO opens on HTTP
 * long-polling and upgrades only if the handshake succeeds. Forcing
 * `['websocket']` breaks wherever the upgrade is refused — AWS App Runner
 * rejects `Upgrade: websocket` with a 403 — so this degrades instead of
 * failing. (Long-polling needs sticky sessions beyond a single API instance.)
 *
 * It's an injection token so tests can provide a fake socket instead.
 */
export const LIVE_SOCKET_FACTORY = new InjectionToken<() => LiveSocket>('LIVE_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => () => io(environment.apiUrl, { transports: ['polling', 'websocket'] }),
});

/** `bookingChanged` payload (services/api/src/bookings/bookings.gateway.ts). */
export interface BookingChangedEvent {
  id: string;
  tutorId: string;
  studentId: string;
  subjectId: string;
  startTime: string;
  endTime: string;
  status: string;
}

/** `messageReceived` payload (services/api/src/messaging/messaging.gateway.ts). */
export interface MessageReceivedEvent {
  id: string;
  conversationId: string;
  senderKind: 'TUTOR' | 'STUDENT';
  body: string;
  createdAt: string;
}

/**
 * The API's Socket.IO gateways as RxJS Observables.
 *
 * Each Observable is *cold*: nothing connects until someone subscribes, every
 * subscriber gets its own connection, and unsubscribing closes it — so a
 * component that subscribes with `takeUntilDestroyed()` cleans up exactly like
 * the React hooks' `return () => socket.close()`.
 */
@Injectable({ providedIn: 'root' })
export class LiveSocketService {
  private readonly connect = inject(LIVE_SOCKET_FACTORY);

  /** Booking changes for one tutor (React: useLiveBookings). */
  bookingChanges(tutorId: string): Observable<BookingChangedEvent> {
    return this.channel<BookingChangedEvent>('subscribeTutor', { tutorId }, 'bookingChanged');
  }

  /** New messages for one tutor (React: useLiveMessages). */
  messages(tutorId: string): Observable<MessageReceivedEvent> {
    return this.channel<MessageReceivedEvent>('subscribeMessages', { tutorId }, 'messageReceived');
  }

  /**
   * Open a connection, join a room, and stream one event type.
   *
   * The room is joined on every `connect` — which socket.io fires on the first
   * connection *and after each automatic reconnect* — so a dropped connection
   * rejoins its room by itself. socket.io owns the reconnect/backoff loop.
   */
  private channel<T>(joinEvent: string, joinPayload: unknown, event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const socket = this.connect();
      const join = (): void => {
        socket.emit(joinEvent, joinPayload);
      };
      const forward = (payload: T): void => subscriber.next(payload);

      socket.on('connect', join);
      socket.on(event, forward);

      // Teardown: runs on unsubscribe (e.g. the component is destroyed).
      return () => {
        socket.off('connect', join);
        socket.off(event, forward);
        socket.close();
      };
    });
  }
}
