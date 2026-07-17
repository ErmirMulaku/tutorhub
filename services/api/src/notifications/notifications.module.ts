import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { BookingNotifier } from './booking-notifier.js';
import { NotificationsResolver } from './notifications.resolver.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule, BookingsModule],
  providers: [NotificationsService, NotificationsResolver, BookingNotifier],
})
export class NotificationsModule {}
