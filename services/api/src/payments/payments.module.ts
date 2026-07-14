import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { PaymentsResolver } from './payments.resolver.js';
import { PaymentsService } from './payments.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';

/**
 * The charge side of payments: student PaymentIntents + the Stripe webhook that
 * reconciles charge/account status. `StripeService` comes from the global
 * StripeModule; booking creation is reused from BookingsModule.
 */
@Module({
  imports: [AuthModule, BookingsModule],
  controllers: [StripeWebhookController],
  providers: [PaymentsService, PaymentsResolver],
})
export class PaymentsModule {}
