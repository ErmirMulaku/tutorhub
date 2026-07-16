import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { BookingEvents } from '../bookings/booking-events.js';
import { BookingStatus, NotificationType } from '../generated/prisma/client.js';
import type { Booking } from '../generated/prisma/client.js';
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

/**
 * Turns booking changes into notifications in the student's feed.
 *
 * The feed, its four types and their localised copy all existed, but nothing
 * ever wrote a row: every notification a student saw came from the seed, so a
 * real booking produced silence. This subscribes to the same in-process bus the
 * Socket.IO gateway uses, so the booking flow itself needs no changes and a
 * failure here can't fail a booking.
 *
 * Live socket events only reach a student who is connected at that moment;
 * these rows are what they find when they come back.
 */
@Injectable()
export class BookingNotifier implements OnModuleInit {
  private readonly logger = new Logger(BookingNotifier.name);

  constructor(
    private readonly events: BookingEvents,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.events.all().subscribe((booking) => {
      // Fire-and-forget: a booking must not fail because its notification did.
      void this.notify(booking).catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Could not notify booking ${booking.id}: ${reason}`);
      });
    });
  }

  private async notify(booking: Booking): Promise<void> {
    const type = NOTIFY_ON[booking.status];
    if (type === undefined) return;

    const [tutor, subject] = await Promise.all([
      this.prisma.tutor.findUnique({ where: { id: booking.tutorId }, select: { name: true } }),
      this.prisma.subject.findUnique({ where: { id: booking.subjectId }, select: { name: true } }),
    ]);
    if (tutor === null || subject === null) return;

    await this.prisma.notification.create({
      data: {
        studentId: booking.studentId,
        type,
        // The copy reads "…with {tutor}", so a first name matches the seed's tone.
        actorName: tutor.name.split(' ')[0] ?? tutor.name,
        detail: subject.name,
      },
    });
  }
}
