import { randomUUID } from 'node:crypto';
import type { Booking, BookingStatus, Prisma } from '../generated/prisma/client.js';

/** Kafka topic for booking events. `.v1` = the envelope's major version. */
export const BOOKINGS_TOPIC = 'tutorhub.bookings.v1';
/** Where a consumer parks a message it could not handle after 5 tries. */
export const BOOKINGS_DLQ_TOPIC = 'tutorhub.bookings.v1.dlq';

export type BookingEventType = 'BookingCreated' | 'BookingStatusChanged' | 'BookingRescheduled';

/** The message every consumer receives. Changing a field's meaning = a new version. */
export interface BookingEventEnvelope {
  /** Unique per event; consumers dedupe on it. */
  eventId: string;
  type: BookingEventType;
  version: 1;
  occurredAt: string;
  data: {
    bookingId: string;
    tutorId: string;
    studentId: string;
    subjectId: string;
    startTime: string;
    endTime: string;
    status: BookingStatus;
    /**
     * The booking's `version` after this change. Events for one booking can
     * arrive out of order (a retried batch, two relays), so a consumer that
     * keeps state should ignore an event older than what it has already seen.
     */
    bookingVersion: number;
  };
}

/**
 * Add a booking event to the outbox, using the caller's transaction. Call it
 * right after the booking write, with the same `tx`: if the transaction rolls
 * back, the event disappears with it; if it commits, the relay will publish it.
 */
export async function recordBookingEvent(
  tx: Prisma.TransactionClient,
  type: BookingEventType,
  booking: Booking,
): Promise<void> {
  const occurredAt = new Date();
  const envelope: BookingEventEnvelope = {
    eventId: randomUUID(),
    type,
    version: 1,
    occurredAt: occurredAt.toISOString(),
    data: {
      bookingId: booking.id,
      tutorId: booking.tutorId,
      studentId: booking.studentId,
      subjectId: booking.subjectId,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      status: booking.status,
      bookingVersion: booking.version,
    },
  };
  await tx.outboxEvent.create({
    data: {
      id: envelope.eventId,
      aggregateType: 'Booking',
      aggregateId: booking.id,
      type,
      payload: { ...envelope, data: { ...envelope.data } },
      // Set here, not by the DB default: Postgres `now()` is the *transaction
      // start* time, and a transaction that waited on a row lock would get an
      // earlier timestamp than the change it waited for.
      createdAt: occurredAt,
    },
  });
}
