import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { StatusController } from './status.controller.js';

/**
 * Monitoring surface (SPEC §13): Prometheus `/metrics`, a `/status` page, and
 * the shared {@link MetricsService} consumed by the global request-metrics
 * middleware (wired in `main.ts`). Liveness/readiness live in HealthController.
 */
@Module({
  providers: [MetricsService],
  controllers: [MetricsController, StatusController],
  exports: [MetricsService],
})
export class MonitoringModule {}
