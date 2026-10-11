import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { RedisLike } from './redis-like.js';

/**
 * The gateway's Redis connection (`REDIS_URL`), for rate limits, budgets,
 * and caching. Wraps (rather than extends) the ioredis client and exposes
 * only the commands the gateway actually uses, via {@link RedisLike}.
 */
@Injectable()
export class RedisService implements RedisLike, OnModuleDestroy {
  private readonly client: Redis;

  // Explicit @Inject: tsx/esbuild doesn't emit emitDecoratorMetadata, so a
  // bare `config: ConfigService` param resolves to undefined under tsx
  // (dev server, scripts) even though it works fine in a tsc build.
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'));
  }

  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  incrby(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  setex(key: string, seconds: number, value: string): Promise<'OK'> {
    return this.client.setex(key, seconds, value);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
