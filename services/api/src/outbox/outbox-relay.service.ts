import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../monitoring/metrics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BOOKINGS_TOPIC } from './booking-event.js';
import { KafkaService } from './kafka.service.js';

const BATCH_SIZE = 100;
const EVERY_MS = 500;
const MAX_BACKOFF_MS = 30_000;

interface PendingRow {
  id: string;
  aggregateId: string;
  payload: unknown;
}

export interface RelayRun {
  published: number;
  failed: number;
}

/**
 * Publishes committed outbox rows to Kafka (the second half of the outbox).
 *
 * Each run, in one transaction: lock up to 100 unpublished rows, oldest first,
 * with `FOR UPDATE SKIP LOCKED`; send them to Kafka keyed by booking id; mark
 * them published; commit. `SKIP LOCKED` lets several relays (one per API pod)
 * run at once: rows locked by one relay are simply skipped by the others, so
 * no row is published twice by two relays and nobody waits.
 *
 * Delivery is at-least-once: if the process dies after Kafka stored the
 * batch but before the commit, the rows are still unpublished and go out
 * again. Consumers must therefore be idempotent.
 *
 * Kill switch: `OUTBOX_PUBLISH_ENABLED=false` stops publishing (events wait in
 * the table). The relay doesn't auto-start under tests (`NODE_ENV=test`);
 * tests call {@link publishPending} directly.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | undefined;
  private backoffMs = EVERY_MS;
  private stopped = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KafkaService) private readonly kafka: KafkaService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<string>('OUTBOX_PUBLISH_ENABLED') !== 'false';
    if (!this.kafka.enabled || !enabled || process.env['NODE_ENV'] === 'test') return;
    this.schedule(0);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** Publish one batch. Returns how many rows went out and how many failed. */
  async publishPending(): Promise<RelayRun> {
    await this.kafka.ensureTopics();
    const run = await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<PendingRow[]>`
          SELECT id, "aggregateId", payload FROM "OutboxEvent"
          WHERE "publishedAt" IS NULL
          ORDER BY "createdAt"
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED`;
        if (rows.length === 0) return { published: 0, failed: 0 };
        const ids = rows.map((row) => row.id);
        try {
          await this.kafka.send(
            BOOKINGS_TOPIC,
            // key = bookingId: all events of one booking land in one partition,
            // and Kafka keeps order within a partition.
            rows.map((row) => ({ key: row.aggregateId, value: JSON.stringify(row.payload) })),
          );
        } catch (error) {
          // Keep the rows (and commit the bookkeeping); they're retried later.
          await tx.outboxEvent.updateMany({
            where: { id: { in: ids } },
            data: { attempts: { increment: 1 }, lastError: String(error).slice(0, 500) },
          });
          return { published: 0, failed: rows.length };
        }
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { publishedAt: new Date() },
        });
        return { published: rows.length, failed: 0 };
      },
      // The Kafka call happens inside the transaction, so allow it time.
      { timeout: 15_000 },
    );
    this.metrics.countOutboxPublished(run.published);
    this.metrics.countOutboxFailures(run.failed);
    this.metrics.setOutboxPending(
      await this.prisma.outboxEvent.count({ where: { publishedAt: null } }),
    );
    return run;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  /** One loop step: publish, then wait 500 ms — or back off (up to 30 s) after a failure. */
  private async tick(): Promise<void> {
    try {
      const run = await this.publishPending();
      if (run.failed > 0) throw new Error(`${run.failed} events failed to publish`);
      this.backoffMs = EVERY_MS;
      // A full batch means there may be more waiting: go again right away.
      this.schedule(run.published === BATCH_SIZE ? 0 : EVERY_MS);
    } catch (error) {
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      this.logger.warn(`Outbox relay: ${String(error)}; retrying in ${this.backoffMs} ms.`);
      this.schedule(this.backoffMs);
    }
  }
}
