import { Injectable } from '@nestjs/common';
import {
  getAvailableSlots,
  type BookingInterval,
  type Slot,
  type WorkingWindow,
} from '@ermulaku/slot-engine';
import { EntityNotFoundError } from '../common/errors.js';
import { BookingStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SLOT_MINUTES = 60;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bookable slots for a tutor on `date` (YYYY-MM-DD, in the tutor's timezone). */
  async getSlots(tutorId: string, date: string): Promise<Slot[]> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (tutor === null) {
      throw new EntityNotFoundError('Tutor', tutorId);
    }

    // Only un-cancelled bookings consume availability.
    const bookings = await this.prisma.booking.findMany({
      where: { tutorId, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
    });
    const existingBookings: BookingInterval[] = bookings.map((booking) => ({
      start: booking.startTime.toISOString(),
      end: booking.endTime.toISOString(),
    }));

    return getAvailableSlots({
      workingHours: tutor.workingHours as unknown as WorkingWindow[],
      existingBookings,
      slotMinutes: SLOT_MINUTES,
      date,
      options: { timezone: tutor.timezone },
    });
  }
}
