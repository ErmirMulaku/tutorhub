import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from '@jest/globals';
import type { LlmClient } from '../../llm/llm-client.js';
import type { Principal } from '../../auth/principal.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { SummarizeConversationTask } from '../summarize-conversation.task.js';

const config = { get: () => 'stub-model' } as unknown as ConfigService;
const llm = {
  converse: () =>
    Promise.resolve({ text: 'summary', inputTokens: 1, outputTokens: 1, modelId: 'stub-model' }),
} as unknown as LlmClient;

function makePrisma(conversation: { tutorId: string } | null): PrismaService {
  return {
    conversation: { findUnique: () => Promise.resolve(conversation) },
    message: { findMany: () => Promise.resolve([]) },
  } as unknown as PrismaService;
}

const owningTutor: Principal = { id: 't1', kind: 'tutor' };
const otherTutor: Principal = { id: 't2', kind: 'tutor' };

describe('SummarizeConversationTask', () => {
  it("404s when the conversation doesn't exist", async () => {
    const task = new SummarizeConversationTask(config, llm, makePrisma(null));

    await expect(
      task.run({ input: { conversationId: 'missing' }, principal: owningTutor }),
    ).rejects.toThrow(NotFoundException);
  });

  it('404s when the conversation belongs to a different tutor', async () => {
    const task = new SummarizeConversationTask(
      config,
      llm,
      makePrisma({ tutorId: owningTutor.id }),
    );

    await expect(
      task.run({ input: { conversationId: 'c1' }, principal: otherTutor }),
    ).rejects.toThrow(NotFoundException);
  });

  it('summarizes a conversation the caller owns', async () => {
    const task = new SummarizeConversationTask(
      config,
      llm,
      makePrisma({ tutorId: owningTutor.id }),
    );

    const result = await task.run({ input: { conversationId: 'c1' }, principal: owningTutor });

    expect(result.answer).toBe('summary');
  });
});
