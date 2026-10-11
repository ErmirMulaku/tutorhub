import { describe, expect, it } from '@jest/globals';
import { checkRateLimit } from '../rate-limit.js';
import { FakeRedis } from './fake-redis.js';

describe('checkRateLimit', () => {
  it('allows the first request in a fresh window', async () => {
    const redis = new FakeRedis();

    const result = await checkRateLimit(redis, 'k', 3, 60);

    expect(result).toEqual({ allowed: true, retryAfterSec: 0 });
  });

  it('allows requests while under the limit', async () => {
    const redis = new FakeRedis();

    await checkRateLimit(redis, 'k', 3, 60);
    const second = await checkRateLimit(redis, 'k', 3, 60);

    expect(second.allowed).toBe(true);
  });

  it('still allows the request that exactly reaches the limit', async () => {
    const redis = new FakeRedis();

    await checkRateLimit(redis, 'k', 3, 60);
    await checkRateLimit(redis, 'k', 3, 60);
    const third = await checkRateLimit(redis, 'k', 3, 60);

    expect(third.allowed).toBe(true);
  });

  it('denies the request one past the limit, with a positive retryAfterSec', async () => {
    const redis = new FakeRedis();

    await checkRateLimit(redis, 'k', 3, 60);
    await checkRateLimit(redis, 'k', 3, 60);
    await checkRateLimit(redis, 'k', 3, 60);
    const fourth = await checkRateLimit(redis, 'k', 3, 60);

    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
    expect(fourth.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('denies immediately when the limit is 0', async () => {
    const redis = new FakeRedis();

    const result = await checkRateLimit(redis, 'k', 0, 60);

    expect(result.allowed).toBe(false);
  });

  it('sets the window to expire after windowSec on the first hit', async () => {
    const redis = new FakeRedis();

    await checkRateLimit(redis, 'k', 3, 60);
    const ttl = await redis.ttl('k');

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('keys are independent — one caller hitting the limit does not affect another', async () => {
    const redis = new FakeRedis();

    await checkRateLimit(redis, 'a', 1, 60);
    const blocked = await checkRateLimit(redis, 'a', 1, 60);
    const otherCaller = await checkRateLimit(redis, 'b', 1, 60);

    expect(blocked.allowed).toBe(false);
    expect(otherCaller.allowed).toBe(true);
  });
});
