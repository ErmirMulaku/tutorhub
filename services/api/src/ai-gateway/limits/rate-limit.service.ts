import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Principal } from '../auth/principal.js';
import { checkRateLimit, type RateLimitResult } from './rate-limit.js';
import { RedisService } from './redis.service.js';
import { addUsage, checkBudget } from './token-budget.js';

const RATE_WINDOW_SEC = 60;

/**
 * Per-principal limits: requests/minute and a daily token budget. Both are
 * scoped by `{kind}:{id}` so a student and a tutor never share a counter,
 * even if one of them somehow reused the other's id.
 */
@Injectable()
export class RateLimitService {
  private readonly requestsPerMinute: number;
  private readonly dailyTokenBudget: number;

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.requestsPerMinute = Number(config.get<string>('AI_RATE_LIMIT_PER_MIN', '20'));
    this.dailyTokenBudget = Number(config.get<string>('AI_DAILY_TOKEN_BUDGET', '50000'));
  }

  /** Fixed one-minute window, keyed by the current epoch minute. */
  checkRequestRate(principal: Principal): Promise<RateLimitResult> {
    const epochMinute = Math.floor(Date.now() / 60_000);
    const key = `ai:rate:${principal.kind}:${principal.id}:${epochMinute}`;
    return checkRateLimit(this.redis, key, this.requestsPerMinute, RATE_WINDOW_SEC);
  }

  checkTokenBudget(principal: Principal): Promise<{ allowed: boolean }> {
    return checkBudget(this.redis, this.budgetKey(principal), this.dailyTokenBudget);
  }

  addTokenUsage(principal: Principal, tokens: number): Promise<void> {
    return addUsage(this.redis, this.budgetKey(principal), tokens);
  }

  /** UTC calendar day, so the budget resets at the same instant everywhere. */
  private budgetKey(principal: Principal): string {
    const day = new Date().toISOString().slice(0, 10);
    return `ai:budget:${principal.kind}:${principal.id}:${day}`;
  }
}
