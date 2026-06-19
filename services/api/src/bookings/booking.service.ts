import { Injectable } from '@nestjs/common';
import type { BookingStatus } from '@ermulaku/types';
import { EntityNotFoundError } from '../common/errors.js';
import type { Booking } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanTransition } from './booking-status.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

export interface BookingFilter {
  status?: BookingStatus;
  tutorId?: string;
  studentId?: string;
}

/**
 * The shared booking service — one source of truth for booking rules across all
 * transports. Status changes always go through the {@link assertCanTransition}
 * state machine.
 */
@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookingDto): Promise<Booking> {
    // Validate references up-front so callers get a clean 404 rather than a
    // raw foreign-key error.
    const [tutor, student, subject] = await Promise.all([
      this.prisma.tutor.findUnique({ where: { id: dto.tutorId } }),
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
    ]);
    if (tutor === null) throw new EntityNotFoundError('Tutor', dto.tutorId);
    if (student === null) throw new EntityNotFoundError('Student', dto.studentId);
    if (subject === null) throw new EntityNotFoundError('Subject', dto.subjectId);

    return this.prisma.booking.create({
      data: {
        tutorId: dto.tutorId,
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
    });
  }

  findAll(filter: BookingFilter = {}): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        status: filter.status,
        tutorId: filter.tutorId,
        studentId: filter.studentId,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findById(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (booking === null) {
      throw new EntityNotFoundError('Booking', id);
    }
    return booking;
  }

  /** Move a booking to `to`, enforcing the lifecycle state machine. */
  async updateStatus(id: string, to: BookingStatus): Promise<Booking> {
    const booking = await this.findById(id);
    assertCanTransition(booking.status, to);
    return this.prisma.booking.update({ where: { id }, data: { status: to } });
  }
}
