import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConflictDomainError, IdempotencyKeyReusedError } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { MetricsService } from '../monitoring/metrics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** How long a key is remembered. A client retrying later than this is a new request. */
const KEY_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_EVERY_MS = 10 * 60 * 1000;
const CLEANUP_BATCH = 1000;

export interface IdempotentRequest {
  key: string;
  /** Who is asking, e.g. `student:<id>`. A key only ever belongs to one caller. */
  principal: string;
  /** {@link hashRequest} of the request body. */
  requestHash: string;
}

export interface IdempotentResult {
  response: Prisma.JsonValue;
  /** True when this is a retry answered from the stored response. */
  replayed: boolean;
}

/** The principal for a student's own requests, the same on every transport. */
export function studentPrincipal(studentId: string): string {
  return `student:${studentId}`;
}

/** sha256 of a flat request object, with keys sorted so their order doesn't matter. */
export function hashRequest(body: Record<string, string | number | boolean | null>): string {
  const sorted = Object.keys(body)
    .sort()
    .map((key) => [key, body[key]]);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Makes a "create" safe to retry. Everything happens in ONE transaction:
 *
 * 1. Insert the key (no response yet). `skipDuplicates` = `ON CONFLICT DO
 *    NOTHING`, so a key that already exists inserts 0 rows instead of failing.
 * 2. 0 rows → someone used this key before; load their row:
 *    - other caller or other body → 422 IDEMPOTENCY_KEY_REUSED
 *    - has a response → return it (a replay; the work is NOT done again)
 *    - no response → 409 REQUEST_IN_PROGRESS
 * 3. 1 row → we own the key: run `work(tx)` and save its response, then commit.
 *
 * Why a parallel duplicate is safe: our uncommitted key row sits in the
 * primary-key index, so the duplicate's insert *waits* for our transaction.
 * When we commit, its insert does nothing and it reads our saved response.
 * If we roll back (the work failed), its insert succeeds and it does the work.
 * Because the response is saved in the same transaction, step 2's "no response
 * yet" can't normally be seen; it's kept as a safe answer if it ever is.
 */
@Injectable()
export class IdempotencyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyService.name);
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async run(
    request: IdempotentRequest,
    work: (tx: Prisma.TransactionClient) => Promise<Prisma.InputJsonValue>,
  ): Promise<IdempotentResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const owned = await this.claim(tx, request);
      if (!owned) {
        return { response: await this.storedResponse(tx, request), replayed: true };
      }
      const response = await work(tx);
      await tx.idempotencyKey.update({
        where: { key: request.key },
        data: { responseJson: response },
      });
      return { response: response as Prisma.JsonValue, replayed: false };
    });
    if (result.replayed) this.metrics.countIdempotentReplay();
    return result;
  }

  /** Insert the key; true if this request now owns it. */
  private async claim(tx: Prisma.TransactionClient, request: IdempotentRequest): Promise<boolean> {
    const now = new Date();
    const fresh = {
      principal: request.principal,
      requestHash: request.requestHash,
      responseJson: undefined,
      createdAt: now,
      expiresAt: new Date(now.getTime() + KEY_TTL_MS),
    };
    const { count } = await tx.idempotencyKey.createMany({
      data: [{ key: request.key, ...fresh }],
      skipDuplicates: true,
    });
    if (count === 1) return true;

    // An expired key that cleanup hasn't deleted yet is up for grabs. The
    // `expiresAt: { lt: now }` condition makes the take-over atomic.
    const takenOver = await tx.idempotencyKey.updateMany({
      where: { key: request.key, expiresAt: { lt: now } },
      data: { ...fresh, responseJson: Prisma.DbNull },
    });
    return takenOver.count === 1;
  }

  private async storedResponse(
    tx: Prisma.TransactionClient,
    request: IdempotentRequest,
  ): Promise<Prisma.JsonValue> {
    const stored = await tx.idempotencyKey.findUniqueOrThrow({ where: { key: request.key } });
    if (stored.principal !== request.principal || stored.requestHash !== request.requestHash) {
      throw new IdempotencyKeyReusedError();
    }
    if (stored.responseJson === null) {
      throw new ConflictDomainError(
        'A request with this Idempotency-Key is still in progress.',
        'REQUEST_IN_PROGRESS',
      );
    }
    return stored.responseJson;
  }

  /** Delete expired keys in batches of 1,000, so no single DELETE runs long. */
  async deleteExpired(now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.prisma.idempotencyKey.findMany({
        where: { expiresAt: { lt: now } },
        select: { key: true },
        take: CLEANUP_BATCH,
      });
      if (batch.length === 0) return total;
      const { count } = await this.prisma.idempotencyKey.deleteMany({
        where: { key: { in: batch.map((row) => row.key) }, expiresAt: { lt: now } },
      });
      total += count;
      if (batch.length < CLEANUP_BATCH) return total;
    }
  }

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      this.deleteExpired().catch((error: unknown) => {
        this.logger.warn(`Idempotency key cleanup failed: ${String(error)}`);
      });
    }, CLEANUP_EVERY_MS);
    // Don't keep the process (or a test run) alive just for this timer.
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
