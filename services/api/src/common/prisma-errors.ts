import { Prisma } from '../generated/prisma/client.js';

/**
 * True when a write hit a unique index (Prisma `P2002`, Postgres `23505`).
 * Under a race this is how "someone else inserted it first" shows up: the
 * second insert waits for the first transaction, then fails here.
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
