import { Injectable } from '@nestjs/common';
import { RedisService } from '../limits/redis.service.js';

/** Thin Redis GET/SETEX wrapper for cached task results. */
@Injectable()
export class AiCacheService {
  constructor(private readonly redis: RedisService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }
}
