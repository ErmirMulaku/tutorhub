import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PrincipalKind } from '../../auth/auth-user.js';
import { RedisService } from '../limits/redis.service.js';

const CONFIRMATION_TTL_SECONDS = 5 * 60;

export interface StoredConfirmation {
  principalKind: PrincipalKind;
  principalId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
}

/**
 * Short-lived, single-use tokens for write tools awaiting confirmation
 * (`chat` task → `POST /ai/chat/confirm`). Backed by the same Redis instance
 * as rate limits/budgets — a token is just a 5-minute key that's deleted the
 * moment it's read, so it can never be replayed.
 */
@Injectable()
export class ConfirmationService {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async create(pending: StoredConfirmation): Promise<string> {
    const token = randomUUID();
    await this.redis.setex(key(token), CONFIRMATION_TTL_SECONDS, JSON.stringify(pending));
    return token;
  }

  /**
   * Looks up a token without consuming it — callers must check ownership
   * (and RBAC) against the result before calling {@link invalidate}. Returns
   * `null` for an unknown, expired, or already-invalidated token.
   *
   * Peek-then-invalidate (rather than one atomic "consume") is deliberate:
   * an unauthorized caller probing someone else's token must not burn it —
   * only the real owner's own attempt should ever invalidate it.
   */
  async get(token: string): Promise<StoredConfirmation | null> {
    const raw = await this.redis.get(key(token));
    return raw === null ? null : (JSON.parse(raw) as StoredConfirmation);
  }

  /** Single-use: call once ownership/RBAC are confirmed, right before executing the tool. */
  async invalidate(token: string): Promise<void> {
    await this.redis.del(key(token));
  }
}

function key(token: string): string {
  return `ai:confirm:${token}`;
}
