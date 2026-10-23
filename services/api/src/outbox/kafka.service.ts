import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel, type Consumer, type Message, type Producer } from 'kafkajs';
import { BOOKINGS_DLQ_TOPIC, BOOKINGS_TOPIC } from './booking-event.js';

/** Partitions for the bookings topic. Messages with the same key (bookingId) share one. */
const BOOKINGS_PARTITIONS = 3;

/**
 * The one place that talks to Kafka. Enabled when `KAFKA_BROKERS` is set
 * (e.g. `localhost:9092`); without it the app runs as before, with no events
 * leaving the process.
 */
@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka: Kafka | null;
  private producer: Producer | null = null;
  private readonly consumers: Consumer[] = [];
  private topicsReady = false;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const brokers = config.get<string>('KAFKA_BROKERS');
    this.kafka =
      brokers === undefined || brokers === ''
        ? null
        : new Kafka({
            clientId: 'tutorhub-api',
            brokers: brokers.split(','),
            // Fail fast: the outbox keeps the event and the relay tries again
            // later, so there's no point waiting long on a broker that's down.
            connectionTimeout: 2_000,
            requestTimeout: 5_000,
            retry: { retries: 2 },
            logLevel: logLevel.ERROR,
          });
  }

  get enabled(): boolean {
    return this.kafka !== null;
  }

  /** Publish messages; resolves only once the broker has stored all of them. */
  async send(topic: string, messages: Message[]): Promise<void> {
    const producer = await this.connectedProducer();
    // acks: -1 = wait for all in-sync replicas — "stored", not just "received".
    await producer.send({ topic, messages, acks: -1 });
  }

  /** A connected consumer in `groupId`. Disconnected when the app shuts down. */
  async consumer(groupId: string): Promise<Consumer> {
    const consumer = this.client().consumer({ groupId });
    await consumer.connect();
    this.consumers.push(consumer);
    return consumer;
  }

  /** Create the topics if they don't exist yet (a no-op when they do). */
  async ensureTopics(): Promise<void> {
    if (this.topicsReady) return;
    const admin = this.client().admin();
    await admin.connect();
    try {
      // Only create what's missing: asking for an existing topic makes kafkajs
      // log a "Topic creation errors" line at ERROR level on every start.
      const existing = new Set(await admin.listTopics());
      const wanted = [
        { topic: BOOKINGS_TOPIC, numPartitions: BOOKINGS_PARTITIONS },
        { topic: BOOKINGS_DLQ_TOPIC, numPartitions: 1 },
      ];
      const missing = wanted.filter(({ topic }) => !existing.has(topic));
      if (missing.length > 0) await admin.createTopics({ topics: missing });
      this.topicsReady = true;
    } finally {
      await admin.disconnect();
    }
  }

  private client(): Kafka {
    if (this.kafka === null) throw new Error('Kafka is not configured — set KAFKA_BROKERS.');
    return this.kafka;
  }

  private async connectedProducer(): Promise<Producer> {
    if (this.producer === null) {
      const producer = this.client().producer();
      await producer.connect();
      this.producer = producer;
    }
    return this.producer;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      ...this.consumers.map((consumer) => consumer.disconnect()),
      this.producer?.disconnect(),
    ]);
    this.logger.debug('Kafka clients disconnected.');
  }
}
