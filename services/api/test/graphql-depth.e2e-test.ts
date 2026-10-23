import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { createValidationPipe } from '../src/common/validation.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const HOUR = 3_600_000;

/** Every Prisma operation the app runs, as "model.operation" (e.g. "tutor.findMany"). */
const operations: string[] = [];

interface Edge {
  cursor: string;
  node: { id: string; startTime: string; tutor: { name: string } };
}
interface Connection {
  edges: Edge[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

/**
 * GraphQL for other teams (FRESHA_DEPTH_SPEC Block 5): DataLoader batching,
 * cursor pagination, errors as data, and the depth limit.
 */
describe('GraphQL depth: loaders, pagination, errors as data (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tutors: { id: string; subjectId: string }[] = [];
  let studentId = '';
  let token = '';
  const stamp = Date.now().toString();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Same PrismaService, plus a client extension that records every query.
      .overrideProvider(PrismaService)
      .useFactory({
        inject: [ConfigService],
        factory: (config: ConfigService) =>
          new PrismaService(config).$extends({
            query: {
              $allOperations({ model, operation, args, query }) {
                operations.push(`${model ?? 'raw'}.${operation}`);
                return query(args);
              },
            },
          }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    // Mon–Sun 09:00–17:00 in UTC, so bookLessonV2 has slots to suggest.
    const workingHours = Array.from({ length: 7 }, (_, day) => ({
      day,
      start: '09:00',
      end: '17:00',
    }));
    for (let n = 0; n < 5; n++) {
      const tutor = await prisma.tutor.create({
        data: {
          name: `Depth Tutor ${n}`,
          timezone: 'UTC',
          hourlyCents: 5000,
          workingHours,
          email: `depth-t${n}+${stamp}@example.com`,
        },
      });
      const subject = await prisma.subject.create({
        data: { name: 'Chemistry', level: 'ADVANCED', tutorId: tutor.id },
      });
      tutors.push({ id: tutor.id, subjectId: subject.id });
    }
    const email = `depth-s+${stamp}@example.com`;
    studentId = (await prisma.student.create({ data: { fullName: 'Depth Student', email } })).id;

    // 120 one-hour lessons, one per day, spread over the 5 tutors.
    await prisma.booking.createMany({
      data: Array.from({ length: 120 }, (_, i) => {
        const tutor = tutors[i % tutors.length];
        const start = new Date(Date.UTC(2035, 0, 1, 10) + i * 24 * HOUR);
        return {
          tutorId: tutor?.id ?? '',
          subjectId: tutor?.subjectId ?? '',
          studentId,
          startTime: start,
          endTime: new Date(start.getTime() + HOUR),
          status: 'CONFIRMED' as const,
        };
      }),
    });

    const login = await http().post('/auth/dev-login').send({ email }).expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    const tutorIds = tutors.map((t) => t.id);
    await prisma.booking.deleteMany({ where: { tutorId: { in: tutorIds } } });
    await prisma.subject.deleteMany({ where: { tutorId: { in: tutorIds } } });
    await prisma.student.deleteMany({ where: { id: studentId } });
    await prisma.tutor.deleteMany({ where: { id: { in: tutorIds } } });
    await app.close();
  });

  function http(): request.Agent {
    return request(app.getHttpServer() as Server);
  }

  async function gql<T>(
    query: string,
    variables: object = {},
  ): Promise<{ data: T; errors?: { message: string; extensions: { code: string } }[] }> {
    const res = await http()
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query, variables });
    return res.body as { data: T; errors?: { message: string; extensions: { code: string } }[] };
  }

  const PAGE = `query Page($first: Int, $after: String) {
    myBookingsConnection(first: $first, after: $after) {
      edges { cursor node { id startTime tutor { name } subject { name } student { fullName } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  it('DataLoader: 50 bookings with tutor + subject + student cost one query per field', async () => {
    operations.length = 0;

    const { data } = await gql<{ myBookingsConnection: Connection }>(PAGE, { first: 50 });

    expect(data.myBookingsConnection.edges).toHaveLength(50);
    const count = (op: string): number => operations.filter((o) => o === op).length;
    expect(count('Booking.findMany')).toBe(1); // the page
    expect(count('Tutor.findMany')).toBe(1); // 5 distinct tutors, one IN (...) query
    expect(count('Subject.findMany')).toBe(1);
    expect(count('Student.findMany')).toBe(1);
    // Without loaders, each field was a findUniqueOrThrow per booking (3 × 50).
    expect(operations.filter((o) => o.endsWith('.findUniqueOrThrow'))).toEqual([]);
  });

  it('cursor pagination walks every booking once, in order, and stops', async () => {
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    do {
      const res: { data: { myBookingsConnection: Connection } } = await gql(PAGE, {
        first: 25,
        after,
      });
      const page: Connection = res.data.myBookingsConnection;
      seen.push(...page.edges.map((e) => e.node.startTime));
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      pages += 1;
    } while (after !== null);

    expect(pages).toBe(5); // 25 + 25 + 25 + 25 + 20
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
    expect([...seen].sort()).toEqual(seen);
  });

  it('a booking added before the cursor does not shift the next page (OFFSET would)', async () => {
    const first = await gql<{ myBookingsConnection: Connection }>(PAGE, { first: 10 });
    const page1 = first.data.myBookingsConnection;
    // A new lesson earlier than everything on page 1.
    const early = await prisma.booking.create({
      data: {
        tutorId: tutors[0]?.id ?? '',
        subjectId: tutors[0]?.subjectId ?? '',
        studentId,
        startTime: new Date(Date.UTC(2034, 11, 1, 10)),
        endTime: new Date(Date.UTC(2034, 11, 1, 11)),
      },
    });

    const second = await gql<{ myBookingsConnection: Connection }>(PAGE, {
      first: 10,
      after: page1.pageInfo.endCursor,
    });

    const page1Ids = new Set(page1.edges.map((e) => e.node.id));
    const page2 = second.data.myBookingsConnection.edges;
    expect(page2.some((e) => page1Ids.has(e.node.id))).toBe(false);
    expect((page2[0]?.node.startTime ?? '') > (page1.edges.at(-1)?.node.startTime ?? '')).toBe(
      true,
    );
    await prisma.booking.delete({ where: { id: early.id } });
  });

  it('first is capped at 100; a bad cursor is BAD_USER_INPUT', async () => {
    const big = await gql<{ myBookingsConnection: Connection }>(PAGE, { first: 1000 });
    expect(big.data.myBookingsConnection.edges).toHaveLength(100);
    expect(big.data.myBookingsConnection.pageInfo.hasNextPage).toBe(true);

    const bad = await gql(PAGE, { first: 5, after: 'garbage' });
    expect(bad.errors?.[0]?.extensions.code).toBe('BAD_USER_INPUT');
  });

  const BOOK_V2 = `mutation Book($input: BookInput!) {
    bookLessonV2(input: $input) {
      __typename
      ... on BookingBooked { booking { id status } }
      ... on SlotUnavailable { message nextFreeSlots }
    }
  }`;

  it('bookLessonV2: free slot → BookingBooked; taken → SlotUnavailable with next free slots', async () => {
    const tutor = tutors[1];
    // A future day with nothing booked for this tutor (the seeded lessons are at 10:00 UTC).
    const start = new Date(Date.UTC(2036, 2, 3, 13));
    const input = {
      tutorId: tutor?.id,
      subjectId: tutor?.subjectId,
      startTime: start.toISOString(),
    };

    const ok = await gql<{ bookLessonV2: { __typename: string; booking: { status: string } } }>(
      BOOK_V2,
      { input },
    );
    expect(ok.data.bookLessonV2).toMatchObject({
      __typename: 'BookingBooked',
      booking: { status: 'PENDING' },
    });

    const taken = await gql<{
      bookLessonV2: { __typename: string; message: string; nextFreeSlots: string[] };
    }>(BOOK_V2, { input });
    expect(taken.errors).toBeUndefined(); // an expected outcome, not an error
    expect(taken.data.bookLessonV2.__typename).toBe('SlotUnavailable');
    expect(taken.data.bookLessonV2.nextFreeSlots).toEqual([
      '2036-03-03T14:00:00.000Z',
      '2036-03-03T15:00:00.000Z',
      '2036-03-03T16:00:00.000Z',
    ]);
  });

  it('rejects a query deeper than 8 before running it', async () => {
    operations.length = 0;
    const deep = '{ a { b { c { d { e { f { g { h { i { j } } } } } } } } } }';
    const res = await http()
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: deep });
    // Apollo reports every validation error with code GRAPHQL_VALIDATION_FAILED
    // (it overwrites ours), so check the message.
    const messages = (res.body as { errors: { message: string }[] }).errors.map((e) => e.message);
    expect(messages).toContain('Query is too deep: depth 10, maximum 8.');
    expect(operations).toEqual([]); // no resolver, no database
  });
});
