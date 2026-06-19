import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

/** Liveness probe. Readiness (`/ready`, DB-checked) and metrics arrive in Phase 6. */
@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOkResponse({ description: 'Service is alive.' })
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
