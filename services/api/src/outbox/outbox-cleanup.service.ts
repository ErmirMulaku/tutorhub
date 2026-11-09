import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { KafkaService } from './kafka.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Keep sent events a week: enough to investigate "was it published?". */
const OUTBOX_KEEP_MS = 7 * DAY_MS;
/** Keep consumer dedupe records far longer than any realistic redelivery. */
const PROCESSED_KEEP_MS = 30 * DAY_MS;
const BATCH = 1000;
const EVERY_MS = 60 * 60 * 1000;

export interface CleanupRun {
  outboxEvents: number;
  processedEvents: number;
}

/**
 * Keeps the outbox tables from growing forever. Every hour, in batches of
 * 1,000 (short statements, short locks):
 *
 * - published OutboxEvent rows older than 7 days — Kafka has them;
 * - with no Kafka configured (`KAFKA_BROKERS` unset, as in production today),
 *   also UNpublished rows older than 7 days: nothing will ever send them, and
 *   notifications went through the in-process path instead. If Kafka is added
 *   later, only the last week of events goes out — older ones are history;
 * - ProcessedEvent dedupe rows older than 30 days.
 *
 * Doesn't run under tests (`NODE_ENV=test`); tests call {@link runOnce}.
 */
@Injectable()
export class OutboxCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxCleanupService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KafkaService) private readonly kafka: KafkaService,
  ) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    this.timer = setInterval(() => {
      this.runOnce().catch((error: unknown) => {
        this.logger.warn(`Outbox cleanup failed: ${String(error)}`);
      });
    }, EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async runOnce(now = new Date()): Promise<CleanupRun> {
    const outboxCutoff = new Date(now.getTime() - OUTBOX_KEEP_MS);
    const outboxEvents = await this.deleteInBatches(
      () =>
        this.prisma.outboxEvent.findMany({
          where: this.kafka.enabled
            ? { publishedAt: { lt: outboxCutoff } }
            : { createdAt: { lt: outboxCutoff } }, // published or never going to be
          select: { id: true },
          take: BATCH,
        }),
      (ids) => this.prisma.outboxEvent.deleteMany({ where: { id: { in: ids } } }),
    );

    const processedCutoff = new Date(now.getTime() - PROCESSED_KEEP_MS);
    let processedEvents = 0;
    for (;;) {
      const rows = await this.prisma.processedEvent.findMany({
        where: { processedAt: { lt: processedCutoff } },
        select: { consumer: true, eventId: true },
        take: BATCH,
      });
      if (rows.length === 0) break;
      const { count } = await this.prisma.processedEvent.deleteMany({ where: { OR: rows } });
      processedEvents += count;
      if (rows.length < BATCH) break;
    }

    if (outboxEvents + processedEvents > 0) {
      this.logger.log(`Outbox cleanup: ${outboxEvents} events, ${processedEvents} dedupe rows.`);
    }
    return { outboxEvents, processedEvents };
  }

  private async deleteInBatches(
    nextBatch: () => Promise<{ id: string }[]>,
    remove: (ids: string[]) => Promise<{ count: number }>,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await nextBatch();
      if (batch.length === 0) return total;
      total += (await remove(batch.map((row) => row.id))).count;
      if (batch.length < BATCH) return total;
    }
  }
}
