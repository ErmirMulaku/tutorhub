import { describe, expect, it, jest } from '@jest/globals';
import type { FeatureFlag } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { bucketOf, decide, FeatureFlagService } from './feature-flag.service.js';

const flag = (over: Partial<FeatureFlag> = {}): FeatureFlag => ({
  key: 'booking.v2_result',
  enabled: true,
  rolloutPercent: 0,
  allowList: [],
  updatedAt: new Date(),
  ...over,
});

describe('decide', () => {
  it('is off for everyone when disabled, even the allow-list', () => {
    expect(decide(flag({ enabled: false, rolloutPercent: 100, allowList: ['s1'] }), 's1')).toBe(
      false,
    );
  });

  it('is on for allow-listed subjects at 0%', () => {
    expect(decide(flag({ allowList: ['s1'] }), 's1')).toBe(true);
    expect(decide(flag({ allowList: ['s1'] }), 's2')).toBe(false);
  });

  it('is on for everyone at 100%', () => {
    expect(decide(flag({ rolloutPercent: 100 }), 'anyone')).toBe(true);
  });

  it('turns on about the given share of subjects, and raising it only adds subjects', () => {
    const ids = Array.from({ length: 10_000 }, (_, i) => `student-${i}`);
    const at10 = ids.filter((id) => decide(flag({ rolloutPercent: 10 }), id));
    const at20 = new Set(ids.filter((id) => decide(flag({ rolloutPercent: 20 }), id)));
    expect(at10.length).toBeGreaterThan(900);
    expect(at10.length).toBeLessThan(1100);
    expect(at10.every((id) => at20.has(id))).toBe(true); // 10% ⊂ 20%
  });

  it('gives each flag a different cohort, and the same answer every time', () => {
    expect(bucketOf('a', 'student-1')).toBe(bucketOf('a', 'student-1'));
    const ids = Array.from({ length: 1_000 }, (_, i) => `s${i}`);
    const same = ids.filter((id) => bucketOf('a', id) === bucketOf('b', id)).length;
    expect(same).toBeLessThan(50); // ~1% would match by chance
  });
});

describe('FeatureFlagService', () => {
  function service(row: FeatureFlag | null): {
    flags: FeatureFlagService;
    findUnique: jest.Mock<() => Promise<FeatureFlag | null>>;
    clock: { t: number };
  } {
    const findUnique = jest.fn(() => Promise.resolve(row));
    const prisma = { featureFlag: { findUnique } } as unknown as PrismaService;
    const clock = { t: 0 };
    return { flags: new FeatureFlagService(prisma, () => clock.t), findUnique, clock };
  }

  it('caches a flag for 30 s, then reads it again', async () => {
    const { flags, findUnique, clock } = service(flag({ rolloutPercent: 100 }));
    await flags.isOn('booking.v2_result', 's1');
    clock.t = 29_999;
    await flags.isOn('booking.v2_result', 's2');
    expect(findUnique).toHaveBeenCalledTimes(1);
    clock.t = 30_000;
    await flags.isOn('booking.v2_result', 's1');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('answers the given default when the flag has no row', async () => {
    const { flags } = service(null);
    await expect(flags.isOn('outbox.publish', 'relay')).resolves.toBe(false);
    await expect(flags.isOn('outbox.publish', 'relay', true)).resolves.toBe(true);
  });
});
