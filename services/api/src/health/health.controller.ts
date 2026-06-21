import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

/** Liveness (`/health`) and readiness (`/ready`, DB-checked) probes (SPEC §13). */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOkResponse({ description: 'Service is alive.' })
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'Service is ready (database reachable).' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unavailable.' })
  async ready(): Promise<{ status: 'ready'; checks: { database: 'up' } }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'down' },
      });
    }
    return { status: 'ready', checks: { database: 'up' } };
  }
}
