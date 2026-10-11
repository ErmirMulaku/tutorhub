import type { RedisLike } from '../redis-like.js';

interface Entry {
  value: number;
  expiresAt: number | null;
}

/**
 * Minimal in-memory stand-in for the Redis commands the limit functions use
 * (no mocking library, per the spec's rules — this is a real, tiny fake).
 * TTLs are wall-clock based (`Date.now()`), so tests that need to see a key
 * expire should use a short `windowSec`/`ttl`, not a `sleep`.
 */
export class FakeRedis implements RedisLike {
  private readonly store = new Map<string, Entry>();

  incr(key: string): Promise<number> {
    return this.incrby(key, 1);
  }

  incrby(key: string, amount: number): Promise<number> {
    const entry = this.store.get(key);
    const value = (entry?.value ?? 0) + amount;
    this.store.set(key, { value, expiresAt: entry?.expiresAt ?? null });
    return Promise.resolve(value);
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return Promise.resolve(0);
    }
    entry.expiresAt = Date.now() + seconds * 1000;
    return Promise.resolve(1);
  }

  ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (entry === undefined || entry.expiresAt === null) {
      return Promise.resolve(-1);
    }
    return Promise.resolve(Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    return Promise.resolve(entry === undefined ? null : String(entry.value));
  }
}
