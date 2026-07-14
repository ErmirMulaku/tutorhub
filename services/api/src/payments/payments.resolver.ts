import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BookInput } from '../bookings/dto/book-input.js';
import { LessonPaymentIntentModel } from '../graphql/models/payments.model.js';
import { type LessonPaymentIntent, PaymentsService } from './payments.service.js';

@Resolver()
export class PaymentsResolver {
  constructor(private readonly payments: PaymentsService) {}

  /** Start paying for a lesson: creates the booking + PaymentIntent, returns the client secret. */
  @Mutation(() => LessonPaymentIntentModel, { name: 'createLessonPaymentIntent' })
  @UseGuards(JwtAuthGuard)
  createLessonPaymentIntent(
    @CurrentUser() user: AuthUser,
    @Args('input') input: BookInput,
  ): Promise<LessonPaymentIntent> {
    return this.payments.createLessonPaymentIntent(user.studentId, input);
  }
}
