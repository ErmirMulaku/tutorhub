import { Injectable } from '@nestjs/common';
import {
  getAvailableSlots,
  type BookingInterval,
  type Slot,
  type WorkingWindow,
} from 'tutorhub-slot-engine';
import { BadRequestDomainError, EntityNotFoundError } from '../common/errors.js';
import { BookingStatus, type TimeOff } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BookingRulesInput,
  TimeOffInput,
  WorkingHourInput,
} from './dto/availability-input.js';

const SLOT_MINUTES = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `date` as YYYY-MM-DD on the wall calendar of `timeZone`. */
function calendarDate(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface MyAvailability {
  workingHours: WorkingHourInput[];
  bufferMinutes: number;
  minNoticeHours: number;
  maxLessonsPerDay: number;
  timeOff: TimeOff[];
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in tutor's working hours, booking rules and time-off list. */
  async myAvailability(tutorId: string): Promise<MyAvailability> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (tutor === null) throw new EntityNotFoundError('Tutor', tutorId);
    const timeOff = await this.prisma.timeOff.findMany({
      where: { tutorId },
      orderBy: { startDate: 'asc' },
    });
    return {
      workingHours: tutor.workingHours as unknown as WorkingHourInput[],
      bufferMinutes: tutor.bufferMinutes,
      minNoticeHours: tutor.minNoticeHours,
      maxLessonsPerDay: tutor.maxLessonsPerDay,
      timeOff,
    };
  }

  async updateWorkingHours(tutorId: string, hours: WorkingHourInput[]): Promise<MyAvailability> {
    // Map to plain objects so Prisma accepts them as a JSON value.
    const json = hours.map((h) => ({ day: h.day, start: h.start, end: h.end }));
    await this.prisma.tutor.update({
      where: { id: tutorId },
      data: { workingHours: json },
    });
    return this.myAvailability(tutorId);
  }

  async updateBookingRules(tutorId: string, rules: BookingRulesInput): Promise<MyAvailability> {
    await this.prisma.tutor.update({ where: { id: tutorId }, data: rules });
    return this.myAvailability(tutorId);
  }

  async addTimeOff(tutorId: string, input: TimeOffInput): Promise<MyAvailability> {
    // Never trust the client's own check: a break can't end before it starts
    // (a one-day break, same start and end, is fine).
    if (input.endDate.getTime() < input.startDate.getTime()) {
      throw new BadRequestDomainError('Time off cannot end before it starts.');
    }
    await this.prisma.timeOff.create({ data: { ...input, tutorId } });
    return this.myAvailability(tutorId);
  }

  async removeTimeOff(tutorId: string, id: string): Promise<MyAvailability> {
    await this.prisma.timeOff.deleteMany({ where: { id, tutorId } });
    return this.myAvailability(tutorId);
  }

  /** Bookable slots for a tutor on `date` (YYYY-MM-DD, in the tutor's timezone). */
  async getSlots(tutorId: string, date: string): Promise<Slot[]> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (tutor === null) {
      throw new EntityNotFoundError('Tutor', tutorId);
    }

    // Only un-cancelled bookings consume availability, and only those near
    // this day matter. `date` is in the tutor's timezone (up to ±14 h from
    // UTC) and buffers reach past midnight, so look one day either side.
    // Without the window this loaded every active booking the tutor ever had.
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const bookings = await this.prisma.booking.findMany({
      where: {
        tutorId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startTime: { lt: new Date(dayStart.getTime() + 2 * DAY_MS) },
        endTime: { gt: new Date(dayStart.getTime() - DAY_MS) },
      },
      select: { startTime: true, endTime: true },
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

  /**
   * The next `count` slot start times at or after `from`, looking up to
   * `days` days ahead. Used to suggest alternatives when a slot is taken, so
   * it skips times that clash with the student's own active lessons too.
   */
  async nextFreeSlots(
    tutorId: string,
    studentId: string,
    from: Date,
    count = 3,
    days = 7,
  ): Promise<Date[]> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (tutor === null) return [];
    const until = new Date(from.getTime() + (days + 1) * DAY_MS);
    const studentLessons = await this.prisma.booking.findMany({
      where: {
        studentId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startTime: { lt: until },
        endTime: { gt: from },
      },
      select: { startTime: true, endTime: true },
    });
    const studentIsFree = (start: Date, end: Date): boolean =>
      studentLessons.every((lesson) => lesson.endTime <= start || lesson.startTime >= end);

    // Calendar days in the tutor's timezone (a Set: stepping 24h can land on
    // the same date twice around a DST change).
    const dates = new Set(
      Array.from({ length: days + 1 }, (_, d) =>
        calendarDate(new Date(from.getTime() + d * DAY_MS), tutor.timezone),
      ),
    );
    const found: Date[] = [];
    for (const date of dates) {
      for (const slot of await this.getSlots(tutorId, date)) {
        const start = new Date(slot.start);
        if (start >= from && studentIsFree(start, new Date(slot.end))) found.push(start);
        if (found.length === count) return found;
      }
    }
    return found;
  }
}
