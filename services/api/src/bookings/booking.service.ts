import { Injectable } from '@nestjs/common';
import {
  BadRequestDomainError,
  ConflictDomainError,
  EntityNotFoundError,
} from '../common/errors.js';
import { isExclusionViolation, isUniqueViolation } from '../common/prisma-errors.js';
import {
  BookingStatus,
  type Booking,
  type Prisma,
  type Review,
} from '../generated/prisma/client.js';
import {
  hashRequest,
  IdempotencyService,
  studentPrincipal,
} from '../idempotency/idempotency.service.js';
import { recordBookingEvent } from '../outbox/booking-event.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingEvents } from './booking-events.js';
import { assertCanTransition } from './booking-status.js';
import { InvalidBookingTransitionError, SlotUnavailableError } from './booking.errors.js';
import type { BookInput } from './dto/book-input.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

const SLOT_MINUTES = 60;
const CHANGED_BY_SOMEONE_ELSE = 'This booking was just changed by someone else.';
const MS_PER_MINUTE = 60_000;

/** A client-supplied key that makes a create safe to retry, and who sent it. */
export interface IdempotencyKeyInput {
  key: string;
  principal: string;
}

/** A booking as stored in `IdempotencyKey.responseJson` (dates as ISO strings). */
type StoredBooking = Omit<Booking, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'> & {
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
};

function bookingToJson(booking: Booking): StoredBooking {
  return {
    ...booking,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

/**
 * The inverse of {@link bookingToJson}. Only ever reads JSON we wrote ourselves.
 * Fields are listed one by one because Postgres `jsonb` doesn't keep key
 * order: this way the first response and every replay are byte-identical.
 */
function bookingFromJson(json: Prisma.JsonValue): Booking {
  const stored = json as unknown as StoredBooking;
  return {
    id: stored.id,
    tutorId: stored.tutorId,
    studentId: stored.studentId,
    subjectId: stored.subjectId,
    startTime: new Date(stored.startTime),
    endTime: new Date(stored.endTime),
    status: stored.status,
    version: stored.version,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

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
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Runs a write that takes a time slot (insert or reschedule).
   *
   * The guarantee is the database's EXCLUDE constraint: an overlapping booking
   * for the same tutor or student is refused, and we turn that refusal into a
   * {@link SlotUnavailableError} that says who is busy.
   *
   * The advisory locks are for *orderly* contention, not correctness. Without
   * them, a burst of clashing inserts makes Postgres deadlock (each EXCLUDE
   * check waits for the other's uncommitted row) and abort them one by one
   * after `deadlock_timeout` (1s). With them, writers for the same tutor or
   * student queue up, and each one after the winner sees its committed row
   * and gets a clean "slot taken". Locks are taken in sorted order so two
   * writers can never wait for each other; they are released at commit.
   *
   * Pass `tx` to run inside a caller's transaction (the idempotent create);
   * otherwise it opens its own.
   */
  private async takeSlot<T>(
    who: { tutorId: string; studentId: string },
    write: (tx: Prisma.TransactionClient) => Promise<T>,
    tx?: Prisma.TransactionClient,
  ): Promise<T> {
    const lockThenWrite = async (db: Prisma.TransactionClient): Promise<T> => {
      for (const id of [who.tutorId, who.studentId].sort()) {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      }
      return write(db);
    };
    try {
      return await (tx === undefined ? this.prisma.$transaction(lockThenWrite) : lockThenWrite(tx));
    } catch (error) {
      if (isExclusionViolation(error, 'booking_no_tutor_overlap')) {
        throw new SlotUnavailableError('tutor');
      }
      if (isExclusionViolation(error, 'booking_no_student_overlap')) {
        throw new SlotUnavailableError('student');
      }
      throw error;
    }
  }

  /**
   * Create a PENDING booking. With `idempotency`, a retry carrying the same key
   * and body gets the first booking back instead of creating a second one.
   */
  async create(dto: CreateBookingDto, idempotency?: IdempotencyKeyInput): Promise<Booking> {
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
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestDomainError('endTime must be after startTime.');
    }

    const insert = (tx?: Prisma.TransactionClient): Promise<Booking> =>
      this.takeSlot(
        dto,
        async (db) => {
          const booking = await db.booking.create({
            data: {
              tutorId: dto.tutorId,
              studentId: dto.studentId,
              subjectId: dto.subjectId,
              startTime,
              endTime,
            },
          });
          await recordBookingEvent(db, 'BookingCreated', booking);
          return booking;
        },
        tx,
      );

    if (idempotency === undefined) {
      const booking = await insert();
      this.events.emit(booking);
      return booking;
    }

    // The key, the booking and the saved response commit together (one tx).
    const { response, replayed } = await this.idempotency.run(
      {
        ...idempotency,
        requestHash: hashRequest({
          tutorId: dto.tutorId,
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      },
      async (tx) => bookingToJson(await insert(tx)),
    );
    // First time and replay both go through the stored JSON, so a retry gets
    // exactly the same response. Only the first one is news for live clients.
    const booking = bookingFromJson(response);
    if (!replayed) this.events.emit(booking);
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
    // The change and its outbox event commit together, or neither does.
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: to, version: { increment: 1 } },
      });
      if (count === 0) {
        throw new ConflictDomainError(CHANGED_BY_SOMEONE_ELSE);
      }
      const changed = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
      await recordBookingEvent(tx, 'BookingStatusChanged', changed);
      return changed;
    });
    // In-process listeners (sockets, gRPC streams) hear about it only after commit.
    this.events.emit(updated);
    return updated;
  }

  /**
   * Student-facing booking: derives a fixed-length end and sets PENDING.
   * `idempotencyKey` (optional) makes a retried request return the first booking.
   */
  bookLesson(input: BookInput, studentId: string, idempotencyKey?: string): Promise<Booking> {
    const start = input.startTime;
    const end = new Date(start.getTime() + SLOT_MINUTES * MS_PER_MINUTE);
    return this.create(
      {
        tutorId: input.tutorId,
        subjectId: input.subjectId,
        studentId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      idempotencyKey === undefined
        ? undefined
        : { key: idempotencyKey, principal: studentPrincipal(studentId) },
    );
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
    const updated = await this.takeSlot(booking, async (tx) => {
      const { count } = await tx.booking.updateMany({
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
      const moved = await tx.booking.findUniqueOrThrow({ where: { id } });
      await recordBookingEvent(tx, 'BookingRescheduled', moved);
      return moved;
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
    const booking = await this.takeSlot({ tutorId, studentId }, async (tx) => {
      const created = await tx.booking.create({
        data: {
          tutorId,
          studentId,
          subjectId,
          startTime,
          endTime: new Date(startTime.getTime() + SLOT_MINUTES * MS_PER_MINUTE),
          status: BookingStatus.CONFIRMED,
        },
      });
      await recordBookingEvent(tx, 'BookingCreated', created);
      return created;
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
