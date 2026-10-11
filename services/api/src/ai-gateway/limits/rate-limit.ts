import type { RedisLike } from './redis-like.js';

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. `0` when `allowed` is `true`. */
  retryAfterSec: number;
}

/**
 * Fixed-window request counter. On the first hit for `key` in a window,
 * `INCR` returns 1 — set that key to expire after `windowSec`. Every
 * further call just increments the same counter until it expires and a
 * fresh window starts.
 *
 * `allowed` is `false` once the count exceeds `limit` (the `limit`-th
 * request itself is still allowed — only the `limit + 1`-th is over).
 * When not allowed, `retryAfterSec` is however many seconds are left
 * on the key's TTL (how long until the caller can succeed again).
 *
 * @param redis - Redis client (`INCR` / `EXPIRE` / `TTL`)
 * @param key - caller + window identity, e.g. `ai:rate:{kind}:{id}:{epochMinute}`
 * @param limit - max requests allowed inside one window
 * @param windowSec - window length in seconds
 */
export async function checkRateLimit(
  redis: RedisLike,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  if (count <= limit) {
    return { allowed: true, retryAfterSec: 0 };
  }
  const ttl = await redis.ttl(key);
  return { allowed: false, retryAfterSec: Math.max(ttl, 0) };
}
