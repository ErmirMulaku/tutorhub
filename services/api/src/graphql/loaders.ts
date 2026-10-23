import DataLoader from 'dataloader';
import type { Review, Student, Subject, Tutor } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Batch loaders for GraphQL field resolvers (the N+1 fix).
 *
 * Without them, `myBookings { tutor { name } }` for 50 bookings runs 1 query
 * for the list and then 50 more, one per `tutor` field. A DataLoader collects
 * every `load(id)` made while one level of the query resolves (same tick),
 * then calls its batch function ONCE with all the ids: `WHERE id IN (...)`.
 * It also caches by id, so the same tutor is fetched once per request.
 *
 * A new set is made for every request (see the GraphQL `context` in
 * app.module.ts). Sharing them across requests would serve stale rows and mix
 * one user's data into another's cache.
 */
export interface Loaders {
  tutor: DataLoader<string, Tutor>;
  subject: DataLoader<string, Subject>;
  student: DataLoader<string, Student>;
  subjectsByTutor: DataLoader<string, Subject[]>;
  reviewsByTutor: DataLoader<string, Review[]>;
  ratingByTutor: DataLoader<string, number | null>;
  reviewCountByTutor: DataLoader<string, number>;
}

/** The GraphQL context every resolver receives. */
export interface GraphQLContext {
  req: unknown;
  loaders: Loaders;
}

/**
 * DataLoader's contract: return one result per key, in the same order as
 * the keys. A row that doesn't exist becomes an Error for that key only.
 */
function byId<T extends { id: string }>(
  ids: readonly string[],
  rows: T[],
  what: string,
): (T | Error)[] {
  const map = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => map.get(id) ?? new Error(`${what} ${id} not found`));
}

/** Group rows by `tutorId`, giving every key a list (empty if it has none). */
function groupByTutor<T extends { tutorId: string }>(ids: readonly string[], rows: T[]): T[][] {
  const groups = new Map<string, T[]>(ids.map((id) => [id, []]));
  for (const row of rows) groups.get(row.tutorId)?.push(row);
  return ids.map((id) => groups.get(id) ?? []);
}

export function createLoaders(prisma: PrismaService): Loaders {
  return {
    tutor: new DataLoader(async (ids) =>
      byId(ids, await prisma.tutor.findMany({ where: { id: { in: [...ids] } } }), 'Tutor'),
    ),
    subject: new DataLoader(async (ids) =>
      byId(ids, await prisma.subject.findMany({ where: { id: { in: [...ids] } } }), 'Subject'),
    ),
    student: new DataLoader(async (ids) =>
      byId(ids, await prisma.student.findMany({ where: { id: { in: [...ids] } } }), 'Student'),
    ),
    subjectsByTutor: new DataLoader(async (tutorIds) =>
      groupByTutor(
        tutorIds,
        await prisma.subject.findMany({
          where: { tutorId: { in: [...tutorIds] } },
          orderBy: { name: 'asc' },
        }),
      ),
    ),
    reviewsByTutor: new DataLoader(async (tutorIds) =>
      groupByTutor(
        tutorIds,
        await prisma.review.findMany({ where: { tutorId: { in: [...tutorIds] } } }),
      ),
    ),
    ratingByTutor: new DataLoader(async (tutorIds) => {
      const rows = await prisma.review.groupBy({
        by: ['tutorId'],
        where: { tutorId: { in: [...tutorIds] } },
        _avg: { rating: true },
      });
      const avg = new Map(rows.map((row) => [row.tutorId, row._avg.rating]));
      return tutorIds.map((id) => avg.get(id) ?? null);
    }),
    reviewCountByTutor: new DataLoader(async (tutorIds) => {
      const rows = await prisma.review.groupBy({
        by: ['tutorId'],
        where: { tutorId: { in: [...tutorIds] } },
        _count: { _all: true },
      });
      const count = new Map(rows.map((row) => [row.tutorId, row._count._all]));
      return tutorIds.map((id) => count.get(id) ?? 0);
    }),
  };
}
