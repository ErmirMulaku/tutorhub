import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { schemaStatus, type SchemaStatus } from './schema-status.js';

/**
 * Liveness (`/health`) and readiness (`/ready`) probes (SPEC §13). Readiness
 * checks the database is reachable AND has every migration this code needs.
 */
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
  @ApiOkResponse({ description: 'Ready: database reachable and schema up to date.' })
  @ApiServiceUnavailableResponse({
    description: 'Database unreachable, or migrations this code needs are not applied.',
  })
  async ready(): Promise<{
    status: 'ready';
    checks: { database: 'up'; schema: 'current' };
    schema: Omit<SchemaStatus, 'pending'>;
  }> {
    let schema: SchemaStatus;
    try {
      schema = await schemaStatus(this.prisma);
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'down' },
      });
    }
    const { pending, ...applied } = schema;
    if (pending.length > 0) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'up', schema: 'behind' },
        schema: { ...applied, pending },
      });
    }
    return { status: 'ready', checks: { database: 'up', schema: 'current' }, schema: applied };
  }
}
