import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from '@jest/globals';
import type { ModelRouterService } from '../../llm/model-router.service.js';
import type { Principal } from '../../auth/principal.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { SummarizeConversationTask } from '../summarize-conversation.task.js';

const config = { get: () => 'stub-model' } as unknown as ConfigService;
const router = {
  run: () =>
    Promise.resolve({
      text: 'summary',
      modelId: 'stub-model',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
    }),
} as unknown as ModelRouterService;

function makePrisma(conversation: { tutorId: string; lastMessageAt: Date } | null): PrismaService {
  return {
    conversation: { findUnique: () => Promise.resolve(conversation) },
    message: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;
}

const owningTutor: Principal = { id: 't1', kind: 'tutor' };
const otherTutor: Principal = { id: 't2', kind: 'tutor' };

describe('SummarizeConversationTask', () => {
  it("404s when the conversation doesn't exist", async () => {
    const task = new SummarizeConversationTask(config, router, makePrisma(null));

    await expect(
      task.run({ input: { conversationId: 'missing' }, principal: owningTutor }),
    ).rejects.toThrow(NotFoundException);
  });

  it('404s when the conversation belongs to a different tutor', async () => {
    const task = new SummarizeConversationTask(
      config,
      router,
      makePrisma({ tutorId: owningTutor.id, lastMessageAt: new Date() }),
    );

    await expect(
      task.run({ input: { conversationId: 'c1' }, principal: otherTutor }),
    ).rejects.toThrow(NotFoundException);
  });

  it('summarizes a conversation the caller owns', async () => {
    const task = new SummarizeConversationTask(
      config,
      router,
      makePrisma({ tutorId: owningTutor.id, lastMessageAt: new Date() }),
    );

    const result = await task.run({ input: { conversationId: 'c1' }, principal: owningTutor });

    expect(result.answer).toBe('summary');
  });

  it('builds a cache key that changes when lastMessageAt changes', async () => {
    const older = new Date('2026-01-01T00:00:00Z');
    const newer = new Date('2026-01-02T00:00:00Z');
    const taskOlder = new SummarizeConversationTask(
      config,
      router,
      makePrisma({ tutorId: owningTutor.id, lastMessageAt: older }),
    );
    const taskNewer = new SummarizeConversationTask(
      config,
      router,
      makePrisma({ tutorId: owningTutor.id, lastMessageAt: newer }),
    );

    const keyOlder = await taskOlder.cacheKey({
      input: { conversationId: 'c1' },
      principal: owningTutor,
    });
    const keyNewer = await taskNewer.cacheKey({
      input: { conversationId: 'c1' },
      principal: owningTutor,
    });

    expect(keyOlder).not.toBe(keyNewer);
  });

  it("404s building a cache key for a conversation the caller doesn't own", async () => {
    const task = new SummarizeConversationTask(
      config,
      router,
      makePrisma({ tutorId: owningTutor.id, lastMessageAt: new Date() }),
    );

    await expect(
      task.cacheKey({ input: { conversationId: 'c1' }, principal: otherTutor }),
    ).rejects.toThrow(NotFoundException);
  });
});
