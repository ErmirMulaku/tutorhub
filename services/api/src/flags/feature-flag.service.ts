import { createHash } from 'node:crypto';
import type { FeatureFlag } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** The flags the code checks. Keep this list short: every flag is debt until removed. */
export const FLAGS = {
  /** bookLessonV2 returns suggested free slots when a slot is taken. Subject: student id. */
  bookingV2Result: 'booking.v2_result',
  /** Kill switch for the outbox relay (Kafka publishing). Subject: 'relay'. Default ON. */
  outboxPublish: 'outbox.publish',
} as const;

const CACHE_MS = 30_000;

/**
 * Which bucket (0–99) a subject falls in for a flag. Stable: the same flag and
 * subject always give the same bucket, so a student doesn't flip between the
 * old and new behaviour on every request, and raising 10% → 20% keeps the
 * first 10% on. The flag key is part of the hash so each flag picks a
 * different 10% (otherwise the same unlucky users would get every experiment).
 */
export function bucketOf(key: string, subjectId: string): number {
  const digest = createHash('sha256').update(`${key}:${subjectId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

/** The rule, on its own: off → false; allow-listed → true; else in the rollout %. */
export function decide(flag: FeatureFlag, subjectId: string): boolean {
  if (!flag.enabled) return false;
  if (flag.allowList.includes(subjectId)) return true;
  return bucketOf(flag.key, subjectId) < flag.rolloutPercent;
}

/**
 * Reads feature flags from the `FeatureFlag` table, cached per instance for
 * 30 s — a flag check must not cost a database query on every request. The
 * price: after a change, each instance can take up to 30 s to notice. That's
 * the number to remember when you flip a kill switch.
 */
export class FeatureFlagService {
  private readonly cache = new Map<string, { flag: FeatureFlag | null; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Is `key` on for `subjectId`? A flag with no row answers `whenMissing`
   * (false by default: new code stays off until someone turns it on; a kill
   * switch passes true so a missing row can't switch the feature off).
   */
  async isOn(key: string, subjectId: string, whenMissing = false): Promise<boolean> {
    const flag = await this.load(key);
    return flag === null ? whenMissing : decide(flag, subjectId);
  }

  private async load(key: string): Promise<FeatureFlag | null> {
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.until > this.now()) return cached.flag;
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    this.cache.set(key, { flag, until: this.now() + CACHE_MS });
    return flag;
  }
}
