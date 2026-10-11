import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { IsString } from 'class-validator';
import { AiGatewayController } from '../ai-gateway.controller.js';
import type { Principal } from '../auth/principal.js';
import type { TaskDefinition } from '../tasks/task-registry.js';
import { TaskRegistryService } from '../tasks/task-registry.js';

class EchoInputDto {
  @IsString()
  question!: string;
}

class ConversationIdInputDto {
  @IsString()
  conversationId!: string;
}

const student: Principal = { id: 's1', kind: 'student' };
const tutor: Principal = { id: 't1', kind: 'tutor' };

function makeController(): AiGatewayController {
  const helpQuestion: TaskDefinition = {
    name: 'help_question',
    allowedKinds: ['student', 'tutor'],
    modelChain: ['stub-model'],
    promptVersion: 1,
    maxOutputTokens: 100,
    temperature: 0,
    cacheTtlSeconds: null,
    inputDto: EchoInputDto,
    run: (ctx) =>
      Promise.resolve({
        answer: `echo: ${(ctx.input as EchoInputDto).question}`,
        model: 'stub-model',
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      }),
  };
  const summarizeConversation: TaskDefinition = {
    name: 'summarize_conversation',
    allowedKinds: ['tutor'],
    modelChain: ['stub-model'],
    promptVersion: 1,
    maxOutputTokens: 100,
    temperature: 0,
    cacheTtlSeconds: null,
    inputDto: ConversationIdInputDto,
    run: () =>
      Promise.resolve({
        answer: 'summary',
        model: 'stub-model',
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      }),
  };
  return new AiGatewayController(new TaskRegistryService([helpQuestion, summarizeConversation]));
}

describe('AiGatewayController', () => {
  it('lists only the tasks the caller may use', () => {
    const controller = makeController();

    expect(controller.tasks(student)).toEqual([{ name: 'help_question' }]);
    expect(controller.tasks(tutor)).toEqual([
      { name: 'help_question' },
      { name: 'summarize_conversation' },
    ]);
  });

  it('runs a known task and returns its result', async () => {
    const controller = makeController();

    const result = await controller.chat(student, {
      task: 'help_question',
      input: { question: 'Can I cancel?' },
    });

    expect(result).toEqual({
      task: 'help_question',
      cached: false,
      answer: 'echo: Can I cancel?',
      model: 'stub-model',
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    });
  });

  it('rejects an unknown task with 400', async () => {
    const controller = makeController();

    await expect(controller.chat(student, { task: 'not_a_task', input: {} })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects bad input for a known task with 400', async () => {
    const controller = makeController();

    await expect(
      controller.chat(student, { task: 'help_question', input: { question: 123 } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a student calling a tutor-only task with 403', async () => {
    const controller = makeController();

    await expect(
      controller.chat(student, { task: 'summarize_conversation', input: {} }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a tutor to call a tutor-only task', async () => {
    const controller = makeController();

    const result = await controller.chat(tutor, {
      task: 'summarize_conversation',
      input: { conversationId: 'c1' },
    });

    expect(result.answer).toBe('summary');
  });
});
