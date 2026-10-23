import { Prisma } from '../generated/prisma/client.js';

/**
 * True when a write hit a unique index (Prisma `P2002`, Postgres `23505`).
 * Under a race this is how "someone else inserted it first" shows up: the
 * second insert waits for the first transaction, then fails here.
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * The Postgres error behind a failed query, when Prisma reports it through the
 * pg driver adapter. Errors Prisma doesn't have its own `P…` code for (e.g. an
 * EXCLUDE constraint) arrive as a `DriverAdapterError` whose `cause` carries
 * the raw SQLSTATE (`code`) and message — checked by experiment on Prisma
 * 7.8 + @prisma/adapter-pg. The constraint name is only in the message.
 */
function postgresCause(error: unknown): { code: string; message: string } | null {
  if (!(error instanceof Error) || error.name !== 'DriverAdapterError') return null;
  const cause = (error as Error & { cause?: { code?: unknown; message?: unknown } }).cause;
  if (typeof cause?.code !== 'string' || typeof cause.message !== 'string') return null;
  return { code: cause.code, message: cause.message };
}

/**
 * If `error` is an exclusion-constraint violation (SQLSTATE `23P01`), returns
 * true when it was raised by the named constraint.
 */
export function isExclusionViolation(error: unknown, constraint: string): boolean {
  const cause = postgresCause(error);
  return cause?.code === '23P01' && cause.message.includes(`"${constraint}"`);
}
