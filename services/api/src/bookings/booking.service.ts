import { Injectable } from '@nestjs/common';
import {
  BadRequestDomainError,
  ConflictDomainError,
  EntityNotFoundError,
} from '../common/errors.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { BookingStatus, type Booking, type Review } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingEvents } from './booking-events.js';
import { assertCanTransition } from './booking-status.js';
import { InvalidBookingTransitionError } from './booking.errors.js';
import type { BookInput } from './dto/book-input.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

const SLOT_MINUTES = 60;
const CHANGED_BY_SOMEONE_ELSE = 'This booking was just changed by someone else.';
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
    return this.transition(await this.findById(id), to);
  }

  /**
   * Apply a status change to a booking we have just read, race-safely.
   *
   * The state machine is checked against the status we read. The write then
   * only applies if the row still has that status (`where: { id, status }`).
   * If someone else changed it in between, Postgres matches 0 rows and we
   * report a conflict instead of overwriting their change (lost update).
   */
  private async transition(booking: Booking, to: BookingStatus): Promise<Booking> {
    assertCanTransition(booking.status, to);
    const { count } = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: to, version: { increment: 1 } },
    });
    if (count === 0) {
      throw new ConflictDomainError(CHANGED_BY_SOMEONE_ELSE);
    }
    const updated = await this.findById(booking.id);
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
    // Optimistic lock: only write if nobody has touched the row since we read
    // it (every write bumps `version`). Otherwise a tutor's cancel that landed
    // in between would be silently overwritten by our stale copy.
    const { count } = await this.prisma.booking.updateMany({
      where: { id, version: booking.version },
      data: {
        startTime,
        endTime: new Date(startTime.getTime() + duration),
        version: { increment: 1 },
      },
    });
    if (count === 0) {
      throw new ConflictDomainError(CHANGED_BY_SOMEONE_ELSE);
    }
    const updated = await this.findById(id);
    this.events.emit(updated);
    return updated;
  }

  /** Cancel a booking the student owns (hidden as 404 if it is not theirs). */
  async cancelForStudent(id: string, studentId: string): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.studentId !== studentId) {
      throw new EntityNotFoundError('Booking', id);
    }
    return this.transition(booking, BookingStatus.CANCELLED);
  }

  // --- Tutor-facing (dashboard) ---

  /** Bookings for a tutor, optionally filtered by status and a [from,to) window. */
  findForTutor(
    tutorId: string,
    opts: { status?: BookingStatus; from?: Date; to?: Date } = {},
  ): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        tutorId,
        status: opts.status,
        startTime: opts.from || opts.to ? { gte: opts.from, lt: opts.to } : undefined,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /** Load a booking, throwing a 404 if it is missing or not this tutor's. */
  private async findOwnedByTutor(id: string, tutorId: string): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.tutorId !== tutorId) {
      throw new EntityNotFoundError('Booking', id);
    }
    return booking;
  }

  /** Tutor accepts a pending request → CONFIRMED. */
  async acceptForTutor(id: string, tutorId: string): Promise<Booking> {
    return this.transition(await this.findOwnedByTutor(id, tutorId), BookingStatus.CONFIRMED);
  }

  /**
   * Tutor declines a pending request → CANCELLED. Only a *request* can be
   * declined: the state machine also allows CONFIRMED → CANCELLED, so without
   * this check a decline arriving just after an accept would cancel the lesson
   * the tutor had just confirmed.
   */
  async declineForTutor(id: string, tutorId: string): Promise<Booking> {
    const booking = await this.findOwnedByTutor(id, tutorId);
    if (booking.status !== BookingStatus.PENDING) {
      throw new InvalidBookingTransitionError(booking.status, BookingStatus.CANCELLED);
    }
    return this.transition(booking, BookingStatus.CANCELLED);
  }

  /** Tutor marks a confirmed lesson done → COMPLETED. */
  async completeForTutor(id: string, tutorId: string): Promise<Booking> {
    return this.transition(await this.findOwnedByTutor(id, tutorId), BookingStatus.COMPLETED);
  }

  /** Tutor books a lesson directly (already CONFIRMED) for one of their students. */
  async createForTutor(
    tutorId: string,
    studentId: string,
    subjectId: string,
    startTime: Date,
  ): Promise<Booking> {
    const [student, subject] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: studentId } }),
      this.prisma.subject.findUnique({ where: { id: subjectId } }),
    ]);
    if (student === null) throw new EntityNotFoundError('Student', studentId);
    if (subject === null || subject.tutorId !== tutorId) {
      throw new EntityNotFoundError('Subject', subjectId);
    }
    const booking = await this.prisma.booking.create({
      data: {
        tutorId,
        studentId,
        subjectId,
        startTime,
        endTime: new Date(startTime.getTime() + SLOT_MINUTES * MS_PER_MINUTE),
        status: BookingStatus.CONFIRMED,
      },
    });
    this.events.emit(booking);
    return booking;
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
    // No "does a review exist?" read first: two parallel requests could both
    // see "no". The unique index on `bookingId` is the real guard — the second
    // insert waits for the first to commit, then fails with P2002.
    try {
      return await this.prisma.review.create({
        data: { bookingId, tutorId: booking.tutorId, rating, comment },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictDomainError('This booking has already been reviewed.');
      }
      throw error;
    }
  }
}
