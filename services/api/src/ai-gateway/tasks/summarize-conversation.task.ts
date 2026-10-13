import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString } from 'class-validator';
import type { PrincipalKind } from '../../auth/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { summarizeConversationCacheKey } from '../cache/cache-keys.js';
import type { StreamToken } from '../llm/llm-client.js';
import { ModelRouterService } from '../llm/model-router.service.js';
import { modelChainFrom } from './model-chain.js';
import type { TaskContext, TaskDefinition, TaskResult } from './task-registry.js';

export class SummarizeConversationInputDto {
  @IsString()
  conversationId!: string;
}

const SYSTEM_PROMPT =
  'Summarize this tutor/student conversation in at most 3 bullet points. ' +
  'Only state facts that appear in the messages — never invent details.';

/** Summarizes the last 30 messages of a conversation the calling tutor owns. */
@Injectable()
export class SummarizeConversationTask implements TaskDefinition<SummarizeConversationInputDto> {
  readonly name = 'summarize_conversation' as const;
  readonly allowedKinds: PrincipalKind[] = ['tutor'];
  readonly modelChain: string[];
  readonly promptVersion = 1;
  readonly maxOutputTokens = 300;
  readonly temperature = 0.2;
  readonly cacheTtlSeconds = 24 * 60 * 60;
  readonly inputDto = SummarizeConversationInputDto;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(ModelRouterService) private readonly router: ModelRouterService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    this.modelChain = modelChainFrom(config);
  }

  /**
   * A cache hit skips `run()` entirely, so this has to re-check ownership
   * itself — it's the only authorization check a cached call gets.
   */
  async cacheKey(ctx: TaskContext<SummarizeConversationInputDto>): Promise<string> {
    const conversation = await this.ownedConversation(ctx);
    return summarizeConversationCacheKey(
      ctx.input.conversationId,
      conversation.lastMessageAt,
      this.promptVersion,
    );
  }

  async run(ctx: TaskContext<SummarizeConversationInputDto>): Promise<TaskResult> {
    const transcript = await this.buildTranscript(ctx);

    const result = await this.router.run(this.modelChain, {
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
      maxOutputTokens: this.maxOutputTokens,
      temperature: this.temperature,
    });
    return {
      answer: result.text,
      model: result.modelId,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    };
  }

  async *runStream(
    ctx: TaskContext<SummarizeConversationInputDto>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamToken, TaskResult> {
    const transcript = await this.buildTranscript(ctx);

    const stream = this.router.runStream(
      this.modelChain,
      {
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: transcript }],
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
      },
      signal,
    );

    let answer = '';
    let next = await stream.next();
    while (!next.done) {
      // This task never passes `tools`, so Bedrock never returns a
      // `tool_use` block — every token here is text.
      if (next.value.kind === 'text') {
        answer += next.value.text;
        yield next.value;
      }
      next = await stream.next();
    }
    const routed = next.value;

    return {
      answer,
      model: routed.modelId,
      usage: {
        inputTokens: routed.inputTokens,
        outputTokens: routed.outputTokens,
        costUsd: routed.costUsd,
      },
    };
  }

  /** Checks ownership (404 if not the caller's conversation), then loads the transcript. */
  private async buildTranscript(ctx: TaskContext<SummarizeConversationInputDto>): Promise<string> {
    await this.ownedConversation(ctx);

    const messages = await this.prisma.message.findMany({
      where: { conversationId: ctx.input.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return messages
      .reverse()
      .map((m) => `${m.senderKind}: ${m.body}`)
      .join('\n');
  }

  /**
   * Same 404 whether the conversation doesn't exist or belongs to another
   * tutor — don't let the response reveal which.
   */
  private async ownedConversation(
    ctx: TaskContext<SummarizeConversationInputDto>,
  ): Promise<{ lastMessageAt: Date }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: ctx.input.conversationId },
      select: { tutorId: true, lastMessageAt: true },
    });
    if (conversation === null || conversation.tutorId !== ctx.principal.id) {
      throw new NotFoundException('Conversation not found.');
    }
    return conversation;
  }
}
