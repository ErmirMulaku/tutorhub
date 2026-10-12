import { createHash } from 'node:crypto';
import type { PrincipalKind } from '../../auth/auth-user.js';

/** Bump when re-ingesting changes what's in the help center, to invalidate old answers. */
export const KB_VERSION = 1;

interface CacheableChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Keyed by the full conversation (not just the latest message) plus the
 * caller's principal kind, since tool availability — and so the possible
 * reply — differs between a student and a tutor. The `chat` task only
 * *writes* under this key when the turn was cacheable (see `TaskResult.cacheable`);
 * an identical repeat of a non-cacheable conversation simply misses.
 */
export function chatCacheKey(
  messages: CacheableChatMessage[],
  principalKind: PrincipalKind,
  promptVersion: number,
): string {
  const normalized = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content.trim() })),
  );
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `ai:cache:chat:${hash}:${principalKind}:kb${KB_VERSION}:p${promptVersion}`;
}

/** Shareable across callers — help-center content is public, so the key has no principal in it. */
export function helpQuestionCacheKey(question: string, promptVersion: number): string {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `ai:cache:help_question:${hash}:kb${KB_VERSION}:p${promptVersion}`;
}

/** `lastMessageAt` in the key means a new message invalidates the cached summary automatically. */
export function summarizeConversationCacheKey(
  conversationId: string,
  lastMessageAt: Date,
  promptVersion: number,
): string {
  return `ai:cache:summarize_conversation:${conversationId}:${lastMessageAt.getTime()}:p${promptVersion}`;
}
