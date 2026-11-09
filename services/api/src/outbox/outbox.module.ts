import { Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module.js';
import { KafkaService } from './kafka.service.js';
import { OutboxCleanupService } from './outbox-cleanup.service.js';
import { OutboxRelayService } from './outbox-relay.service.js';

@Module({
  imports: [MonitoringModule],
  providers: [KafkaService, OutboxRelayService, OutboxCleanupService],
  exports: [KafkaService, OutboxRelayService, OutboxCleanupService],
})
export class OutboxModule {}
