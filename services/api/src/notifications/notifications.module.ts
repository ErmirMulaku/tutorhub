import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MonitoringModule } from '../monitoring/monitoring.module.js';
import { OutboxModule } from '../outbox/outbox.module.js';
import { BookingNotificationsConsumer } from './booking-notifications.consumer.js';
import { BookingNotifier } from './booking-notifier.js';
import { NotificationsResolver } from './notifications.resolver.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule, BookingsModule, OutboxModule, MonitoringModule],
  providers: [
    NotificationsService,
    NotificationsResolver,
    BookingNotifier,
    BookingNotificationsConsumer,
  ],
})
export class NotificationsModule {}
