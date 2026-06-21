import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';

/** Prometheus scrape endpoint. */
@ApiTags('monitoring')
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOkResponse({ description: 'Prometheus exposition-format metrics.' })
  scrape(): Promise<string> {
    return this.metrics.metrics();
  }
}
