import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { KafkaMessage } from 'kafkajs';
import { MetricsService } from '../monitoring/metrics.service.js';
import {
  BOOKINGS_DLQ_TOPIC,
  BOOKINGS_TOPIC,
  type BookingEventEnvelope,
} from '../outbox/booking-event.js';
import { KafkaService } from '../outbox/kafka.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingNotifier } from './booking-notifier.js';

export const NOTIFICATIONS_CONSUMER = 'notifications';
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 200;

export type ConsumeResult = 'processed' | 'duplicate' | 'ignored';

/**
 * Reads `tutorhub.bookings.v1` (consumer group `notifications`) and writes the
 * student's notification for each status change.
 *
 * Idempotent consumer: Kafka delivers at least once (and the outbox relay may
 * publish an event twice), so the event id is recorded in `ProcessedEvent`
 * in the SAME transaction as the notification. A repeat inserts 0 rows and
 * does nothing — one event, one notification, however often it arrives.
 *
 * A message that keeps failing is tried 5 times, then parked on the DLQ topic
 * so it doesn't block the partition behind it.
 */
@Injectable()
export class BookingNotificationsConsumer implements OnModuleInit {
  private readonly logger = new Logger(BookingNotificationsConsumer.name);

  constructor(
    @Inject(KafkaService) private readonly kafka: KafkaService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BookingNotifier) private readonly notifier: BookingNotifier,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (!this.kafka.enabled || process.env['NODE_ENV'] === 'test') return;
    // Don't block app start-up on the broker; log and carry on if it's down.
    void this.start().catch((error: unknown) => {
      this.logger.error(`Notifications consumer failed to start: ${String(error)}`);
    });
  }

  /**
   * Join the consumer group and start handling messages. A brand-new group
   * starts from the oldest message (`fromBeginning`); an existing group
   * resumes from its last committed offset either way.
   */
  async start(groupId = NOTIFICATIONS_CONSUMER, fromBeginning = true): Promise<void> {
    await this.kafka.ensureTopics();
    const consumer = await this.kafka.consumer(groupId);
    await consumer.subscribe({ topic: BOOKINGS_TOPIC, fromBeginning });
    const joined = new Promise<void>((resolve) => {
      consumer.on(consumer.events.GROUP_JOIN, () => resolve());
    });
    await consumer.run({ eachMessage: ({ message }) => this.handleMessage(message) });
    await joined;
  }

  /** Handle one message with retries; after the last failure, send it to the DLQ. */
  async handleMessage(message: KafkaMessage): Promise<void> {
    const raw = message.value?.toString() ?? '';
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await this.consume(raw);
        this.metrics.countConsumerEvent(NOTIFICATIONS_CONSUMER, result);
        return;
      } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
          continue;
        }
        this.logger.error(
          `Dead-lettering message after ${MAX_ATTEMPTS} attempts: ${String(error)}`,
        );
        await this.kafka.send(BOOKINGS_DLQ_TOPIC, [
          {
            key: message.key,
            value: message.value,
            headers: { error: String(error).slice(0, 500), consumer: NOTIFICATIONS_CONSUMER },
          },
        ]);
        this.metrics.countConsumerEvent(NOTIFICATIONS_CONSUMER, 'dead_lettered');
        return;
      }
    }
  }

  /** Apply one event exactly once. Throws if it can't be applied (it's retried). */
  async consume(raw: string): Promise<ConsumeResult> {
    const event = parseEnvelope(raw);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.processedEvent.createMany({
        data: [{ consumer: NOTIFICATIONS_CONSUMER, eventId: event.eventId }],
        skipDuplicates: true,
      });
      if (count === 0) return 'duplicate';
      if (event.type !== 'BookingStatusChanged') return 'ignored';
      const written = await this.notifier.writeFor(tx, event.data);
      return written ? 'processed' : 'ignored';
    });
  }
}

/** Minimal shape check — a malformed message must fail loudly, not write garbage. */
function parseEnvelope(raw: string): BookingEventEnvelope {
  const value = JSON.parse(raw) as Partial<BookingEventEnvelope> | null;
  if (
    typeof value?.eventId !== 'string' ||
    typeof value.type !== 'string' ||
    typeof value.data?.studentId !== 'string' ||
    typeof value.data.status !== 'string'
  ) {
    throw new Error('Not a booking event envelope.');
  }
  return value as BookingEventEnvelope;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
