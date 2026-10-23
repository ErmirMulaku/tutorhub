import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { BookingEvents } from '../bookings/booking-events.js';
import { BookingStatus, NotificationType, type Prisma } from '../generated/prisma/client.js';
import { KafkaService } from '../outbox/kafka.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Booking statuses worth telling the student about, and what to call it.
 *
 * PENDING is the student's own request, so it would only tell them what they
 * just did. NO_SHOW is the tutor's record-keeping, not news for the student.
 */
const NOTIFY_ON: Partial<Record<BookingStatus, NotificationType>> = {
  [BookingStatus.CONFIRMED]: NotificationType.BOOKING_CONFIRMED,
  [BookingStatus.CANCELLED]: NotificationType.BOOKING_CANCELLED,
  // A finished lesson is what the client turns into "how was it?".
  [BookingStatus.COMPLETED]: NotificationType.REVIEW_PROMPT,
};

/** The booking fields a notification needs. */
export interface NotifiableBooking {
  studentId: string;
  tutorId: string;
  subjectId: string;
  status: BookingStatus;
}

/**
 * Turns booking status changes into notifications in the student's feed.
 *
 * With Kafka configured, the `BookingNotificationsConsumer` calls
 * {@link writeFor} for each `BookingStatusChanged` event — durable, because the
 * event comes from the outbox, which commits with the booking.
 *
 * Without Kafka (`KAFKA_BROKERS` unset), it falls back to the old in-process
 * bus: fire-and-forget, so a crash between the booking commit and this
 * listener loses the notification (the dual-write problem the outbox fixes).
 */
@Injectable()
export class BookingNotifier implements OnModuleInit {
  private readonly logger = new Logger(BookingNotifier.name);

  constructor(
    private readonly events: BookingEvents,
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  onModuleInit(): void {
    if (this.kafka.enabled) return; // the Kafka consumer owns notifications
    this.events.all().subscribe((booking) => {
      // Fire-and-forget: a booking must not fail because its notification did.
      void this.writeFor(this.prisma, booking).catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Could not notify booking: ${reason}`);
      });
    });
  }

  /** Write the student's notification for this status, if it's one we notify on. */
  async writeFor(
    db: Prisma.TransactionClient | PrismaService,
    booking: NotifiableBooking,
  ): Promise<boolean> {
    const type = NOTIFY_ON[booking.status];
    if (type === undefined) return false;

    const [tutor, subject] = await Promise.all([
      db.tutor.findUnique({ where: { id: booking.tutorId }, select: { name: true } }),
      db.subject.findUnique({ where: { id: booking.subjectId }, select: { name: true } }),
    ]);
    if (tutor === null || subject === null) return false;

    await db.notification.create({
      data: {
        studentId: booking.studentId,
        type,
        // The copy reads "…with {tutor}", so a first name matches the seed's tone.
        actorName: tutor.name.split(' ')[0] ?? tutor.name,
        detail: subject.name,
      },
    });
    return true;
  }
}
