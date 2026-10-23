import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Thin Nest wrapper around the generated Prisma client, managing its lifecycle.
 * Prisma 7 connects through a driver adapter (`@prisma/adapter-pg`) rather than
 * a schema-level `url`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
        // Connections this instance may open (node-postgres default: 10).
        // instances × this must stay below Postgres max_connections — see
        // docs/operations.md "Connection pool math".
        max: Number(config.get<string>('DATABASE_POOL_SIZE') ?? 10),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
