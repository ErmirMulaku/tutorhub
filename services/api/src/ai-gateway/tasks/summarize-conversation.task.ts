import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString } from 'class-validator';
import type { PrincipalKind } from '../../auth/auth-user.js';
import { LLM_CLIENT, type LlmClient } from '../llm/llm-client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { modelChainFrom } from './model-chain.js';
import type { TaskContext, TaskDefinition, TaskResult } from './task-registry.js';

export class SummarizeConversationInputDto {
  @IsString()
  conversationId!: string;
}

const SYSTEM_PROMPT =
  'Summarize this tutor/student conversation in at most 3 bullet points. ' +
  'Only state facts that appear in the messages — never invent details.';

/**
 * Summarizes the last 30 messages of a conversation. Ownership scoping
 * (the conversation must belong to the calling tutor) lands in Block 2,
 * once a principal exists to scope against.
 */
@Injectable()
export class SummarizeConversationTask implements TaskDefinition<SummarizeConversationInputDto> {
  readonly name = 'summarize_conversation' as const;
  readonly allowedKinds: PrincipalKind[] = ['tutor'];
  readonly modelChain: string[];
  private readonly primaryModelId: string;
  readonly promptVersion = 1;
  readonly maxOutputTokens = 300;
  readonly temperature = 0.2;
  readonly cacheTtlSeconds = 24 * 60 * 60;
  readonly inputDto = SummarizeConversationInputDto;

  constructor(
    config: ConfigService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly prisma: PrismaService,
  ) {
    const chain = modelChainFrom(config);
    this.modelChain = chain;
    this.primaryModelId = chain[0];
  }

  async run(ctx: TaskContext<SummarizeConversationInputDto>): Promise<TaskResult> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId: ctx.input.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const transcript = messages
      .reverse()
      .map((m) => `${m.senderKind}: ${m.body}`)
      .join('\n');

    const result = await this.llm.converse({
      modelId: this.primaryModelId,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
      maxOutputTokens: this.maxOutputTokens,
      temperature: this.temperature,
    });
    return {
      answer: result.text,
      model: result.modelId,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: 0 },
    };
  }
}
