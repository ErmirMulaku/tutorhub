import { Injectable } from '@nestjs/common';
import { BadRequestDomainError, EntityNotFoundError } from '../common/errors.js';
import { BookingStatus, type Booking, type Review } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingEvents } from './booking-events.js';
import { assertCanTransition } from './booking-status.js';
import type { BookInput } from './dto/book-input.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

const SLOT_MINUTES = 60;
const MS_PER_MINUTE = 60_000;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: BookingEvents,
  ) {}

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

    const booking = await this.prisma.booking.create({
      data: {
        tutorId: dto.tutorId,
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
    });
    this.events.emit(booking);
    return booking;
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
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: to } });
    this.events.emit(updated);
    return updated;
  }

  /** Student-facing booking: derives a fixed-length end and sets PENDING. */
  bookLesson(input: BookInput, studentId: string): Promise<Booking> {
    const start = input.startTime;
    const end = new Date(start.getTime() + SLOT_MINUTES * MS_PER_MINUTE);
    return this.create({
      tutorId: input.tutorId,
      subjectId: input.subjectId,
      studentId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
  }

  /** Move a student's own upcoming booking to a new start time (same duration). */
  async rescheduleForStudent(id: string, studentId: string, startTime: Date): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.studentId !== studentId) {
      throw new EntityNotFoundError('Booking', id);
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestDomainError('Only upcoming bookings can be rescheduled.');
    }
    const duration = booking.endTime.getTime() - booking.startTime.getTime();
    const updated = await this.prisma.booking.update({
      where: { id },
      data: { startTime, endTime: new Date(startTime.getTime() + duration) },
    });
    this.events.emit(updated);
    return updated;
  }

  /** Cancel a booking the student owns (hidden as 404 if it is not theirs). */
  async cancelForStudent(id: string, studentId: string): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.studentId !== studentId) {
      throw new EntityNotFoundError('Booking', id);
    }
    return this.updateStatus(id, BookingStatus.CANCELLED);
  }

  /** Leave a review for the student's own completed booking. */
  async leaveReview(
    bookingId: string,
    studentId: string,
    rating: number,
    comment: string | null,
  ): Promise<Review> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestDomainError('rating must be between 1 and 5.');
    }
    const booking = await this.findById(bookingId);
    if (booking.studentId !== studentId) {
      throw new EntityNotFoundError('Booking', bookingId);
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestDomainError('Only completed bookings can be reviewed.');
    }
    const existing = await this.prisma.review.findUnique({ where: { bookingId } });
    if (existing !== null) {
      throw new BadRequestDomainError('This booking has already been reviewed.');
    }
    return this.prisma.review.create({
      data: { bookingId, tutorId: booking.tutorId, rating, comment },
    });
  }
}
