import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BookingSource, BookingStatus } from '../generated/prisma/client.js';
import type { Booking, Review, Student, Subject, Tutor } from '../generated/prisma/client.js';
import type { Loaders } from '../graphql/loaders.js';
import { AvailabilityService } from '../availability/availability.service.js';
import {
  BookLessonResult,
  type SlotUnavailableModel,
} from '../graphql/models/book-lesson-result.model.js';
import { BookingConnectionModel } from '../graphql/models/booking-connection.model.js';
import { BookingModel } from '../graphql/models/booking.model.js';
import { ReviewModel } from '../graphql/models/review.model.js';
import { StudentModel } from '../graphql/models/student.model.js';
import { SubjectModel } from '../graphql/models/subject.model.js';
import { TutorModel } from '../graphql/models/tutor.model.js';
import { BookingService, DEFAULT_PAGE_SIZE, type BookingPage } from './booking.service.js';
import { SlotUnavailableError } from './booking.errors.js';
import { BookInput } from './dto/book-input.js';

/**
 * Which app made the request. The mobile app identifies itself with an
 * `X-Client: mobile` header; anything else (marketplace, GraphiQL) is web.
 */
function sourceOf(req: { headers?: Record<string, unknown> } | undefined): BookingSource {
  return req?.headers?.['x-client'] === 'mobile' ? BookingSource.MOBILE : BookingSource.WEB;
}

@Resolver(() => BookingModel)
export class BookingResolver {
  constructor(
    private readonly bookings: BookingService,
    private readonly availability: AvailabilityService,
  ) {}

  @Query(() => [BookingModel], {
    name: 'myBookings',
    // Kept working for existing clients (marketplace, mobile); not removed,
    // because removing a field breaks every client still asking for it.
    deprecationReason: 'Unbounded list. Use myBookingsConnection (cursor pagination).',
  })
  @UseGuards(JwtAuthGuard)
  myBookings(
    @CurrentUser() user: AuthUser,
    @Args('status', { type: () => BookingStatus, nullable: true })
    status: BookingStatus | undefined,
  ): Promise<Booking[]> {
    return this.bookings.findAll({ studentId: user.studentId, status });
  }

  @Query(() => BookingConnectionModel, { name: 'myBookingsConnection' })
  @UseGuards(JwtAuthGuard)
  myBookingsConnection(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, defaultValue: DEFAULT_PAGE_SIZE }) first: number,
    @Args('after', { type: () => String, nullable: true }) after: string | undefined,
    @Args('status', { type: () => BookingStatus, nullable: true })
    status: BookingStatus | undefined,
  ): Promise<BookingPage> {
    return this.bookings.findPage(
      // `?? undefined`: GraphQL may send an explicit null, which Prisma rejects.
      { studentId: user.studentId, status: status ?? undefined },
      first,
      after ?? undefined,
    );
  }

  @Mutation(() => BookingModel, { name: 'bookLesson' })
  @UseGuards(JwtAuthGuard)
  bookLesson(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => BookInput }) input: BookInput,
    @Context('req') req: { headers?: Record<string, unknown> } | undefined,
  ): Promise<Booking> {
    return this.bookings.bookLesson(input, user.studentId, input.idempotencyKey, sourceOf(req));
  }

  /**
   * Like `bookLesson`, but a taken slot is a normal result, not an error:
   * `SlotUnavailable { message, nextFreeSlots }`. `bookLesson` stays as it is
   * for existing clients.
   */
  @Mutation(() => BookLessonResult, { name: 'bookLessonV2' })
  @UseGuards(JwtAuthGuard)
  async bookLessonV2(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => BookInput }) input: BookInput,
    @Context('req') req: { headers?: Record<string, unknown> } | undefined,
  ): Promise<{ booking: Booking } | SlotUnavailableModel> {
    try {
      const booking = await this.bookings.bookLesson(
        input,
        user.studentId,
        input.idempotencyKey,
        sourceOf(req),
      );
      return { booking };
    } catch (error) {
      if (!(error instanceof SlotUnavailableError)) throw error;
      return {
        message: error.message,
        nextFreeSlots: await this.availability.nextFreeSlots(
          input.tutorId,
          user.studentId,
          input.startTime,
        ),
      };
    }
  }

  @Mutation(() => BookingModel, { name: 'rescheduleBooking' })
  @UseGuards(JwtAuthGuard)
  rescheduleBooking(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('startTime') startTime: string,
  ): Promise<Booking> {
    return this.bookings.rescheduleForStudent(id, user.studentId, new Date(startTime));
  }

  @Mutation(() => BookingModel, { name: 'cancelBooking' })
  @UseGuards(JwtAuthGuard)
  cancelBooking(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('reason', { type: () => String, nullable: true }) _reason: string | undefined,
  ): Promise<Booking> {
    return this.bookings.cancelForStudent(id, user.studentId);
  }

  @Mutation(() => ReviewModel, { name: 'leaveReview' })
  @UseGuards(JwtAuthGuard)
  leaveReview(
    @CurrentUser() user: AuthUser,
    @Args('bookingId', { type: () => ID }) bookingId: string,
    @Args('rating', { type: () => Int }) rating: number,
    @Args('comment', { type: () => String, nullable: true }) comment: string | undefined,
  ): Promise<Review> {
    return this.bookings.leaveReview(bookingId, user.studentId, rating, comment ?? null);
  }

  // Batched per request (DataLoader): a list of N bookings costs one query
  // per field, not N.
  @ResolveField(() => TutorModel)
  tutor(@Parent() booking: Booking, @Context('loaders') loaders: Loaders): Promise<Tutor> {
    return loaders.tutor.load(booking.tutorId);
  }

  @ResolveField(() => SubjectModel)
  subject(@Parent() booking: Booking, @Context('loaders') loaders: Loaders): Promise<Subject> {
    return loaders.subject.load(booking.subjectId);
  }

  @ResolveField(() => StudentModel)
  student(@Parent() booking: Booking, @Context('loaders') loaders: Loaders): Promise<Student> {
    return loaders.student.load(booking.studentId);
  }
}
