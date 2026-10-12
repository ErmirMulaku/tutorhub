import { createHash } from 'node:crypto';

/** Bump when re-ingesting changes what's in the help center, to invalidate old answers. */
export const KB_VERSION = 1;

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
