import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { IsString } from 'class-validator';
import { AiGatewayController } from '../ai-gateway.controller.js';
import type { TaskDefinition } from '../tasks/task-registry.js';
import { TaskRegistryService } from '../tasks/task-registry.js';

class EchoInputDto {
  @IsString()
  question!: string;
}

function makeController(): AiGatewayController {
  const task: TaskDefinition = {
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
  return new AiGatewayController(new TaskRegistryService([task]));
}

describe('AiGatewayController', () => {
  it('lists registered tasks', () => {
    const controller = makeController();

    expect(controller.tasks()).toEqual([{ name: 'help_question' }]);
  });

  it('runs a known task and returns its result', async () => {
    const controller = makeController();

    const result = await controller.chat({
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

    await expect(controller.chat({ task: 'not_a_task', input: {} })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects bad input for a known task with 400', async () => {
    const controller = makeController();

    await expect(
      controller.chat({ task: 'help_question', input: { question: 123 } }),
    ).rejects.toThrow(BadRequestException);
  });
});
