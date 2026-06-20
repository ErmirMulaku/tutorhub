import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BookingStatus } from '../generated/prisma/client.js';
import type { Booking, Review, Student, Subject, Tutor } from '../generated/prisma/client.js';
import { BookingModel } from '../graphql/models/booking.model.js';
import { ReviewModel } from '../graphql/models/review.model.js';
import { StudentModel } from '../graphql/models/student.model.js';
import { SubjectModel } from '../graphql/models/subject.model.js';
import { TutorModel } from '../graphql/models/tutor.model.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService } from './booking.service.js';
import { BookInput } from './dto/book-input.js';

@Resolver(() => BookingModel)
export class BookingResolver {
  constructor(
    private readonly bookings: BookingService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [BookingModel], { name: 'myBookings' })
  @UseGuards(JwtAuthGuard)
  myBookings(
    @CurrentUser() user: AuthUser,
    @Args('status', { type: () => BookingStatus, nullable: true })
    status: BookingStatus | undefined,
  ): Promise<Booking[]> {
    return this.bookings.findAll({ studentId: user.studentId, status });
  }

  @Mutation(() => BookingModel, { name: 'bookLesson' })
  @UseGuards(JwtAuthGuard)
  bookLesson(@CurrentUser() user: AuthUser, @Args('input') input: BookInput): Promise<Booking> {
    return this.bookings.bookLesson(input, user.studentId);
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

  @ResolveField(() => TutorModel)
  tutor(@Parent() booking: Booking): Promise<Tutor> {
    return this.prisma.tutor.findUniqueOrThrow({ where: { id: booking.tutorId } });
  }

  @ResolveField(() => SubjectModel)
  subject(@Parent() booking: Booking): Promise<Subject> {
    return this.prisma.subject.findUniqueOrThrow({ where: { id: booking.subjectId } });
  }

  @ResolveField(() => StudentModel)
  student(@Parent() booking: Booking): Promise<Student> {
    return this.prisma.student.findUniqueOrThrow({ where: { id: booking.studentId } });
  }
}
