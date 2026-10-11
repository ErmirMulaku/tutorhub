import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MaxLength } from 'class-validator';
import type { PrincipalKind } from '../../auth/auth-user.js';
import { ModelRouterService } from '../llm/model-router.service.js';
import { modelChainFrom } from './model-chain.js';
import type { TaskContext, TaskDefinition, TaskResult } from './task-registry.js';

export class HelpQuestionInputDto {
  @IsString()
  @MaxLength(500)
  question!: string;
}

const SYSTEM_PROMPT =
  "You are TutorHub's help assistant. Answer ONLY from the sources. " +
  "If the answer is not in the sources, say you don't know. Cite sources like [1], [2].";

/**
 * Answers a student/tutor question from the help center (RAG retrieval
 * lands in Block 6 — for now this forwards the raw question to the LLM).
 */
@Injectable()
export class HelpQuestionTask implements TaskDefinition<HelpQuestionInputDto> {
  readonly name = 'help_question' as const;
  readonly allowedKinds: PrincipalKind[] = ['student', 'tutor'];
  readonly modelChain: string[];
  readonly promptVersion = 1;
  readonly maxOutputTokens = 400;
  readonly temperature = 0.2;
  readonly cacheTtlSeconds = 24 * 60 * 60;
  readonly inputDto = HelpQuestionInputDto;

  constructor(
    config: ConfigService,
    private readonly router: ModelRouterService,
  ) {
    this.modelChain = modelChainFrom(config);
  }

  async run(ctx: TaskContext<HelpQuestionInputDto>): Promise<TaskResult> {
    const result = await this.router.run(this.modelChain, {
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: ctx.input.question }],
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
}
