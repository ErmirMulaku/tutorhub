import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { TutorDashboardResolver } from './tutor-dashboard.resolver.js';
import { TutorDashboardService } from './tutor-dashboard.service.js';

@Module({
  imports: [AuthModule, BookingsModule, MessagingModule],
  providers: [TutorDashboardService, TutorDashboardResolver],
})
export class TutorDashboardModule {}
