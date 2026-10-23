import { Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module.js';
import { KafkaService } from './kafka.service.js';
import { OutboxRelayService } from './outbox-relay.service.js';

@Module({
  imports: [MonitoringModule],
  providers: [KafkaService, OutboxRelayService],
  exports: [KafkaService, OutboxRelayService],
})
export class OutboxModule {}
