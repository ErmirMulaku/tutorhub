import { Injectable } from '@nestjs/common';
import {
  getAvailableSlots,
  type BookingInterval,
  type Slot,
  type WorkingWindow,
} from 'tutorhub-slot-engine';
import { EntityNotFoundError } from '../common/errors.js';
import { BookingStatus, type TimeOff } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BookingRulesInput,
  TimeOffInput,
  WorkingHourInput,
} from './dto/availability-input.js';

const SLOT_MINUTES = 60;

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
