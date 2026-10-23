import { Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module.js';
import { IdempotencyService } from './idempotency.service.js';

@Module({
  imports: [MonitoringModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
