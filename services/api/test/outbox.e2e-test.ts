import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Kafka, logLevel, type Consumer } from 'kafkajs';
import { AppModule } from '../src/app.module.js';
import { BookingService } from '../src/bookings/booking.service.js';
import { MetricsService } from '../src/monitoring/metrics.service.js';
import { NotificationType } from '../src/generated/prisma/client.js';
import { BookingNotificationsConsumer } from '../src/notifications/booking-notifications.consumer.js';
import { BOOKINGS_TOPIC, type BookingEventEnvelope } from '../src/outbox/booking-event.js';
import { KafkaService } from '../src/outbox/kafka.service.js';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const HOUR = 3_600_000;
const brokers = process.env['KAFKA_BROKERS'];

/** Poll until `check` returns true, or fail after `ms`. */
async function eventually(check: () => Promise<boolean>, ms = 15_000): Promise<void> {
  const until = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > until) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Transactional outbox + Kafka (FRESHA_DEPTH_SPEC Block 4), against a real
 * Postgres and a real Redpanda. Needs `KAFKA_BROKERS` (e.g. localhost:9092;
 * `docker compose up -d redpanda`); skipped without it.
 */
(brokers === undefined ? describe.skip : describe)('Outbox + Kafka (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bookings: BookingService;
  let relay: OutboxRelayService;
  const ids = { tutor: '', subject: '', students: [] as string[] };
  const stamp = Date.now().toString();
  let day = 0;
  const readers: Consumer[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingService);
    relay = app.get(OutboxRelayService);

    const tutor = await prisma.tutor.create({
      data: {
        name: 'Outbox Tutor',
        timezone: 'UTC',
        hourlyCents: 5000,
        workingHours: [],
        email: `outbox-t+${stamp}@example.com`,
      },
    });
    const subject = await prisma.subject.create({
      data: { name: 'Physics', level: 'ADVANCED', tutorId: tutor.id },
    });
    ids.tutor = tutor.id;
    ids.subject = subject.id;
    for (let n = 0; n < 30; n++) {
      const student = await prisma.student.create({
        data: { fullName: `Outbox Student ${n}`, email: `outbox-s${n}+${stamp}@example.com` },
      });
      ids.students.push(student.id);
    }
  });

  afterAll(async () => {
    await Promise.allSettled(readers.map((reader) => reader.disconnect()));
    const bookingIds = (
      await prisma.booking.findMany({ where: { tutorId: ids.tutor }, select: { id: true } })
    ).map((b) => b.id);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.subject.deleteMany({ where: { tutorId: ids.tutor } });
    await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
    await prisma.tutor.deleteMany({ where: { id: ids.tutor } });
    await app.close();
  });

  const student = (n: number): string => {
    const id = ids.students[n];
    if (id === undefined) throw new Error(`No student ${n}`);
    return id;
  };
  const nextStart = (): Date => {
    day += 1;
    return new Date(Date.UTC(2033, 0, 1, 9) + day * 24 * HOUR);
  };
  const book = (n: number, startTime = nextStart()): ReturnType<BookingService['bookLesson']> =>
    bookings.bookLesson({ tutorId: ids.tutor, subjectId: ids.subject, startTime }, student(n));

  const eventsFor = (bookingId: string): ReturnType<PrismaService['outboxEvent']['findMany']> =>
    prisma.outboxEvent.findMany({
      where: { aggregateId: bookingId },
      orderBy: { createdAt: 'asc' },
    });

  /** Publish until our tutor's events are all out (other suites add rows too). */
  async function publishAll(): Promise<void> {
    await eventually(async () => {
      await relay.publishPending();
      const pending = await prisma.outboxEvent.count({
        where: { publishedAt: null, payload: { path: ['data', 'tutorId'], equals: ids.tutor } },
      });
      return pending === 0;
    });
  }

  /** A fresh Kafka reader collecting our tutor's events from the start of the topic. */
  async function readOurEvents(): Promise<BookingEventEnvelope[]> {
    const kafka = new Kafka({
      clientId: 'outbox-e2e',
      brokers: (brokers ?? '').split(','),
      logLevel: logLevel.ERROR,
    });
    const reader = kafka.consumer({ groupId: `outbox-e2e-${stamp}-${readers.length}` });
    readers.push(reader);
    const seen: BookingEventEnvelope[] = [];
    await reader.connect();
    await reader.subscribe({ topic: BOOKINGS_TOPIC, fromBeginning: true });
    await reader.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value?.toString() ?? '{}') as BookingEventEnvelope;
        if (event.data?.tutorId === ids.tutor) seen.push(event);
        return Promise.resolve();
      },
    });
    return seen;
  }

  it('a booking and its event commit together — a failed write leaves no event', async () => {
    const start = nextStart();
    const booking = await book(0, start);

    const events = await eventsFor(booking.id);
    expect(events.map((e) => e.type)).toEqual(['BookingCreated']);
    const payload = events[0]?.payload as unknown as BookingEventEnvelope;
    expect(payload).toMatchObject({
      eventId: events[0]?.id,
      type: 'BookingCreated',
      version: 1,
      data: { bookingId: booking.id, status: 'PENDING', bookingVersion: 0 },
    });

    const ourEvents = { payload: { path: ['data', 'tutorId'], equals: ids.tutor } };
    const before = await prisma.outboxEvent.count({ where: ourEvents });
    // Rolled back by the overlap constraint → its event row rolls back too.
    await expect(book(1, start)).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    // Rolled back by the conditional update (Block 1) → no event either.
    await bookings.acceptForTutor(booking.id, ids.tutor);
    await expect(bookings.acceptForTutor(booking.id, ids.tutor)).rejects.toBeDefined();
    const after = await prisma.outboxEvent.count({ where: ourEvents });
    expect(after - before).toBe(1); // only the successful accept

    expect((await eventsFor(booking.id)).map((e) => e.type)).toEqual([
      'BookingCreated',
      'BookingStatusChanged',
    ]);
  });

  it('two relays at once publish every event exactly once (SKIP LOCKED)', async () => {
    for (let n = 2; n < 22; n++) await book(n);

    // Two "pods" relaying at the same moment, several rounds.
    for (let round = 0; round < 5; round++) {
      await Promise.all([relay.publishPending(), relay.publishPending()]);
    }
    await publishAll();

    const outbox = await prisma.outboxEvent.findMany({
      where: { payload: { path: ['data', 'tutorId'], equals: ids.tutor } },
    });
    const seen = await readOurEvents();
    await eventually(() => Promise.resolve(seen.length >= outbox.length));
    await new Promise((resolve) => setTimeout(resolve, 1_000)); // any duplicates arrive too

    const counts = new Map<string, number>();
    for (const event of seen) counts.set(event.eventId, (counts.get(event.eventId) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual(outbox.map((row) => row.id).sort());
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
  });

  it('a duplicated message produces one notification (idempotent consumer)', async () => {
    const booking = await book(22);
    await bookings.acceptForTutor(booking.id, ids.tutor);
    const [, accepted] = await eventsFor(booking.id);
    const raw = JSON.stringify(accepted?.payload);
    const consumer = app.get(BookingNotificationsConsumer);

    const results = await Promise.all([consumer.consume(raw), consumer.consume(raw)]);

    expect(results.sort()).toEqual(['duplicate', 'processed']);
    const notes = await prisma.notification.findMany({ where: { studentId: student(22) } });
    expect(notes.map((n) => n.type)).toEqual([NotificationType.BOOKING_CONFIRMED]);
  });

  it('end to end: accept → outbox → Kafka → consumer → notification, once', async () => {
    const consumer = app.get(BookingNotificationsConsumer);
    await consumer.start(`notifications-e2e-${stamp}`, false);
    const booking = await book(23);

    await bookings.acceptForTutor(booking.id, ids.tutor);
    await publishAll();

    const feed = (): Promise<number> =>
      prisma.notification.count({ where: { studentId: student(23) } });
    await eventually(async () => (await feed()) === 1);

    // Kafka redelivers the same event (e.g. a relay crashed before marking it).
    const [, accepted] = await eventsFor(booking.id);
    await app
      .get(KafkaService)
      .send(BOOKINGS_TOPIC, [{ key: booking.id, value: JSON.stringify(accepted?.payload) }]);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(await feed()).toBe(1);
  });

  it('with the broker down, bookings still work; events wait and go out later', async () => {
    const deadKafka = new KafkaService({
      get: (name: string) => (name === 'KAFKA_BROKERS' ? 'localhost:1' : undefined),
    } as unknown as ConfigService);
    const deadRelay = new OutboxRelayService(
      prisma,
      deadKafka,
      app.get(MetricsService),
      app.get(ConfigService),
    );

    // Flush older unpublished rows first: the relay always takes the oldest
    // rows, so a backlog would keep our new row out of the failing batch.
    await relay.publishPending();
    while ((await relay.publishPending()).published > 0);

    const booking = await book(24); // the API never talks to Kafka here
    await expect(deadRelay.publishPending()).rejects.toThrow();
    // ensureTopics failed before any row was touched; now publish with topics
    // already present to exercise the per-row failure bookkeeping:
    Object.assign(deadKafka, { topicsReady: true });
    const run = await deadRelay.publishPending();
    expect(run.published).toBe(0);
    expect(run.failed).toBeGreaterThan(0);
    const [waiting] = await eventsFor(booking.id);
    expect(waiting).toMatchObject({ publishedAt: null, attempts: 1 });
    expect(waiting?.lastError).toEqual(expect.any(String));
    await deadKafka.onModuleDestroy();

    // The broker is back: the same row goes out.
    await publishAll();
    const [sent] = await eventsFor(booking.id);
    expect(sent?.publishedAt).toBeInstanceOf(Date);
  }, 60_000);
});
