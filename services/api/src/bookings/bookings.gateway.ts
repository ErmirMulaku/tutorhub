import { type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { Booking } from '../generated/prisma/client.js';
import { BookingEvents } from './booking-events.js';

interface BookingChangedPayload {
  id: string;
  tutorId: string;
  studentId: string;
  subjectId: string;
  startTime: string;
  endTime: string;
  status: string;
}

function toPayload(booking: Booking): BookingChangedPayload {
  return {
    id: booking.id,
    tutorId: booking.tutorId,
    studentId: booking.studentId,
    subjectId: booking.subjectId,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    status: booking.status,
  };
}

const room = (tutorId: string): string => `tutor:${tutorId}`;

/**
 * Pushes live booking changes to the dashboard. Clients join a tutor's room via
 * `subscribeTutor`; every change from {@link BookingEvents} is fanned out to the
 * matching room as a `bookingChanged` event.
 */
@WebSocketGateway({ cors: { origin: true } })
export class BookingsGateway implements OnModuleInit {
  @WebSocketServer() private readonly server!: Server;

  constructor(private readonly events: BookingEvents) {}

  onModuleInit(): void {
    this.events.all().subscribe((booking) => {
      this.server.to(room(booking.tutorId)).emit('bookingChanged', toPayload(booking));
    });
  }

  @SubscribeMessage('subscribeTutor')
  subscribeTutor(
    @MessageBody() data: { tutorId: string },
    @ConnectedSocket() client: Socket,
  ): { subscribed: string } {
    void client.join(room(data.tutorId));
    return { subscribed: data.tutorId };
  }
}
