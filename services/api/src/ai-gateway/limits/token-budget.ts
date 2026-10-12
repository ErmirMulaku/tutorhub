import type { RedisLike } from './redis-like.js';

/**
 * `allowed` is `true` while today's recorded usage is still under
 * `dailyBudget`, `false` once it has reached or passed it. Called BEFORE
 * the model call — it doesn't reserve tokens for the call about to
 * happen, so a request already in flight can still push the total slightly
 * over budget before {@link addUsage} runs after it. That overshoot is
 * accepted on purpose: the alternative (reserving a guessed token count
 * up front) would either overcharge the budget for short answers or still
 * undercount for long ones, since the real count isn't known until the
 * model responds.
 *
 * @param redis - Redis client (`GET`)
 * @param key - caller + day identity, e.g. `ai:budget:{kind}:{id}:{YYYY-MM-DD}`
 * @param dailyBudget - max tokens allowed per day
 */
export async function checkBudget(
  redis: RedisLike,
  key: string,
  dailyBudget: number,
): Promise<{ allowed: boolean }> {
  const raw = await redis.get(key);
  const usedSoFar = raw === null ? 0 : Number(raw);
  return { allowed: usedSoFar < dailyBudget };
}

/**
 * Adds real token usage to today's counter AFTER a call completes
 * (`INCRBY`). Sets the key to expire 2 days out on first use — well past
 * midnight, so the counter outlives the day it's tracking by a safe
 * margin and still gets cleaned up automatically rather than growing
 * forever.
 *
 * @param redis - Redis client (`INCRBY` / `EXPIRE`)
 * @param key - same key {@link checkBudget} was called with
 * @param tokens - real input + output tokens spent by this call
 */
export async function addUsage(redis: RedisLike, key: string, tokens: number): Promise<void> {
  const total = await redis.incrby(key, tokens);
  if (total === tokens) {
    await redis.expire(key, 2 * 24 * 60 * 60);
  }
}
