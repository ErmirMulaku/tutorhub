import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import {
  BookingService,
  DEFAULT_PAGE_SIZE,
  type BookingPage,
} from '../bookings/booking.service.js';
import { BookingStatus, type Booking, type Subject } from '../generated/prisma/client.js';
import { BookingConnectionModel } from '../graphql/models/booking-connection.model.js';
import { BookingModel } from '../graphql/models/booking.model.js';
import { DashboardSummaryModel } from '../graphql/models/dashboard-summary.model.js';
import { SubjectModel } from '../graphql/models/subject.model.js';
import {
  TutorNotificationModel,
  TutorStudentRefModel,
} from '../graphql/models/tutor-misc.model.js';
import {
  type DashboardSummary,
  type StudentRef,
  type TutorNotification,
  TutorDashboardService,
} from './tutor-dashboard.service.js';

@Resolver(() => BookingModel)
@UseGuards(TutorAuthGuard)
export class TutorDashboardResolver {
  constructor(
    private readonly dashboard: TutorDashboardService,
    private readonly bookings: BookingService,
  ) {}

  @Query(() => DashboardSummaryModel, { name: 'dashboardSummary' })
  dashboardSummary(@CurrentTutor() tutor: TutorPrincipal): Promise<DashboardSummary> {
    return this.dashboard.summary(tutor.tutorId);
  }

  @Query(() => [BookingModel], { name: 'todaySchedule' })
  todaySchedule(@CurrentTutor() tutor: TutorPrincipal): Promise<Booking[]> {
    return this.dashboard.todaySchedule(tutor.tutorId);
  }

  @Query(() => [BookingModel], { name: 'tutorBookings' })
  tutorBookings(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('status', { type: () => BookingStatus, nullable: true })
    status: BookingStatus | undefined,
    @Args('from', { type: () => String, nullable: true }) from: string | undefined,
    @Args('to', { type: () => String, nullable: true }) to: string | undefined,
  ): Promise<Booking[]> {
    return this.bookings.findForTutor(tutor.tutorId, {
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * The tutor's bookings, one page at a time (cursor pagination). The old
   * `tutorBookings` stays for the calendar, which always asks for a bounded
   * from/to window.
   */
  @Query(() => BookingConnectionModel, { name: 'tutorBookingsConnection' })
  tutorBookingsConnection(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('first', { type: () => Int, defaultValue: DEFAULT_PAGE_SIZE }) first: number,
    @Args('after', { type: () => String, nullable: true }) after: string | undefined,
    @Args('status', { type: () => BookingStatus, nullable: true })
    status: BookingStatus | undefined,
    @Args('from', { type: () => String, nullable: true }) from: string | undefined,
    @Args('to', { type: () => String, nullable: true }) to: string | undefined,
  ): Promise<BookingPage> {
    return this.bookings.findPage(
      {
        tutorId: tutor.tutorId,
        // `?? undefined`: GraphQL may send an explicit null, which Prisma rejects.
        status: status ?? undefined,
        startTime:
          from || to
            ? { gte: from ? new Date(from) : undefined, lt: to ? new Date(to) : undefined }
            : undefined,
      },
      first,
      after ?? undefined,
    );
  }

  @Mutation(() => BookingModel, { name: 'acceptBooking' })
  acceptBooking(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Booking> {
    return this.bookings.acceptForTutor(id, tutor.tutorId);
  }

  @Mutation(() => BookingModel, { name: 'declineBooking' })
  declineBooking(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Booking> {
    return this.bookings.declineForTutor(id, tutor.tutorId);
  }

  @Mutation(() => BookingModel, { name: 'completeBooking' })
  completeBooking(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Booking> {
    return this.bookings.completeForTutor(id, tutor.tutorId);
  }

  // --- New-lesson pickers + create + notifications ---

  @Query(() => [TutorStudentRefModel], { name: 'myStudents' })
  myStudents(@CurrentTutor() tutor: TutorPrincipal): Promise<StudentRef[]> {
    return this.dashboard.myStudents(tutor.tutorId);
  }

  @Query(() => [SubjectModel], { name: 'mySubjects' })
  mySubjects(@CurrentTutor() tutor: TutorPrincipal): Promise<Subject[]> {
    return this.dashboard.mySubjects(tutor.tutorId);
  }

  @Query(() => [TutorNotificationModel], { name: 'tutorNotifications' })
  tutorNotifications(@CurrentTutor() tutor: TutorPrincipal): Promise<TutorNotification[]> {
    return this.dashboard.notifications(tutor.tutorId);
  }

  @Mutation(() => BookingModel, { name: 'createLesson' })
  createLesson(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('studentId', { type: () => ID }) studentId: string,
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('startTime') startTime: string,
  ): Promise<Booking> {
    return this.bookings.createForTutor(tutor.tutorId, studentId, subjectId, new Date(startTime));
  }
}
