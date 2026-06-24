import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsResolver } from './notifications.resolver.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule],
  providers: [NotificationsService, NotificationsResolver],
})
export class NotificationsModule {}
