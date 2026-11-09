import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import type { KafkaService } from '../src/outbox/kafka.service.js';
import { OutboxCleanupService } from '../src/outbox/outbox-cleanup.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;

/** The outbox tables don't grow forever, with or without Kafka. */
describe('Outbox cleanup (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = `cleanup-${Date.now()}`;
  const now = new Date();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: tag } } });
    await prisma.processedEvent.deleteMany({ where: { consumer: tag } });
    await app.close();
  });

  /** One outbox row per case, identified by its aggregateId. */
  async function seed(): Promise<void> {
    const ago = (days: number): Date => new Date(now.getTime() - days * DAY);
    const rows = {
      'old-published': { createdAt: ago(10), publishedAt: ago(10) },
      'new-published': { createdAt: ago(1), publishedAt: ago(1) },
      'old-unpublished': { createdAt: ago(10), publishedAt: null },
      'new-unpublished': { createdAt: ago(1), publishedAt: null },
    };
    await prisma.outboxEvent.createMany({
      data: Object.entries(rows).map(([name, dates]) => ({
        aggregateType: 'Booking',
        aggregateId: `${tag}-${name}`,
        type: 'BookingCreated',
        payload: {},
        ...dates,
      })),
    });
    await prisma.processedEvent.createMany({
      data: [
        { consumer: tag, eventId: 'old', processedAt: ago(40) },
        { consumer: tag, eventId: 'new', processedAt: ago(1) },
      ],
    });
  }

  async function left(): Promise<string[]> {
    const rows = await prisma.outboxEvent.findMany({
      where: { aggregateId: { startsWith: tag } },
      select: { aggregateId: true },
    });
    return rows.map((r) => r.aggregateId.slice(tag.length + 1)).sort();
  }

  function cleanup(kafkaEnabled: boolean): OutboxCleanupService {
    return new OutboxCleanupService(prisma, { enabled: kafkaEnabled } as KafkaService);
  }

  it('with Kafka: deletes old published events only; unpublished ones still wait to be sent', async () => {
    await seed();
    await cleanup(true).runOnce(now);
    expect(await left()).toEqual(['new-published', 'new-unpublished', 'old-unpublished']);
    const dedupe = await prisma.processedEvent.findMany({ where: { consumer: tag } });
    expect(dedupe.map((r) => r.eventId)).toEqual(['new']);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: tag } } });
    await prisma.processedEvent.deleteMany({ where: { consumer: tag } });
  });

  it('without Kafka: old unpublished events go too — nothing will ever send them', async () => {
    await seed();
    await cleanup(false).runOnce(now);
    expect(await left()).toEqual(['new-published', 'new-unpublished']);
  });
});
