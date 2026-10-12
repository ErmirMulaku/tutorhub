import { describe, expect, it } from '@jest/globals';
import { addUsage, checkBudget } from '../token-budget.js';
import { FakeRedis } from './fake-redis.js';

describe('checkBudget', () => {
  it('allows a caller with no usage recorded yet', async () => {
    const redis = new FakeRedis();

    const result = await checkBudget(redis, 'k', 1000);

    expect(result).toEqual({ allowed: true });
  });

  it('allows a caller under budget', async () => {
    const redis = new FakeRedis();
    await addUsage(redis, 'k', 400);

    const result = await checkBudget(redis, 'k', 1000);

    expect(result.allowed).toBe(true);
  });

  it('denies a caller exactly at budget', async () => {
    const redis = new FakeRedis();
    await addUsage(redis, 'k', 1000);

    const result = await checkBudget(redis, 'k', 1000);

    expect(result.allowed).toBe(false);
  });

  it('denies a caller over budget', async () => {
    const redis = new FakeRedis();
    await addUsage(redis, 'k', 1500);

    const result = await checkBudget(redis, 'k', 1000);

    expect(result.allowed).toBe(false);
  });
});

describe('addUsage', () => {
  it('accumulates real token counts across calls', async () => {
    const redis = new FakeRedis();

    await addUsage(redis, 'k', 300);
    await addUsage(redis, 'k', 250);

    expect(await redis.get('k')).toBe('550');
  });

  it('sets the counter to expire (so it is cleaned up, not kept forever)', async () => {
    const redis = new FakeRedis();

    await addUsage(redis, 'k', 10);
    const ttl = await redis.ttl('k');

    expect(ttl).toBeGreaterThan(0);
  });

  it('check-before / add-after: budget only reflects usage once addUsage has run', async () => {
    const redis = new FakeRedis();

    const before = await checkBudget(redis, 'k', 100);
    await addUsage(redis, 'k', 60);
    const afterFirstCall = await checkBudget(redis, 'k', 100);
    await addUsage(redis, 'k', 50);
    const afterSecondCall = await checkBudget(redis, 'k', 100);

    expect(before.allowed).toBe(true);
    expect(afterFirstCall.allowed).toBe(true);
    expect(afterSecondCall.allowed).toBe(false);
  });
});
