import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import { BookingService } from '../bookings/booking.service.js';
import { BookingStatus, type Booking } from '../generated/prisma/client.js';
import { BookingModel } from '../graphql/models/booking.model.js';
import { DashboardSummaryModel } from '../graphql/models/dashboard-summary.model.js';
import { type DashboardSummary, TutorDashboardService } from './tutor-dashboard.service.js';

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
}
