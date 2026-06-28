import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AnalyticsResolver } from './analytics.resolver.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [AuthModule],
  providers: [AnalyticsService, AnalyticsResolver],
})
export class AnalyticsModule {}
