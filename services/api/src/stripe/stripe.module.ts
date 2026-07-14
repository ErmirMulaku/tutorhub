import { Global, Module } from '@nestjs/common';
import { StripeService } from './stripe.service.js';

/** Global so any feature module (bookings, earnings, wallet) can inject {@link StripeService}. */
@Global()
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
