import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentPrincipal } from './auth/current-principal.decorator.js';
import { PrincipalGuard } from './auth/principal.guard.js';
import type { Principal } from './auth/principal.js';
import { AiChatRequestDto } from './dto/ai-chat.dto.js';
import { RateLimitService } from './limits/rate-limit.service.js';
import { TaskRegistryService, type TaskName, type TaskResult } from './tasks/task-registry.js';
import { validateTaskInput } from './validate-task-input.js';

export interface AiChatResponseBody extends TaskResult {
  task: TaskName;
  cached: boolean;
}

export interface AiTaskSummary {
  name: TaskName;
}

@ApiTags('ai-gateway')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(PrincipalGuard)
export class AiGatewayController {
  constructor(
    private readonly registry: TaskRegistryService,
    private readonly limits: RateLimitService,
  ) {}

  @Get('tasks')
  @ApiOkResponse({ description: 'Tasks the caller may use.' })
  tasks(@CurrentPrincipal() principal: Principal): AiTaskSummary[] {
    return this.registry
      .list()
      .filter((task) => task.allowedKinds.includes(principal.kind))
      .map((task) => ({ name: task.name }));
  }

  @Post('chat')
  @ApiOkResponse({ description: 'The task answer, model used, and token/cost usage.' })
  async chat(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: AiChatRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AiChatResponseBody> {
    const task = this.registry.get(dto.task);
    if (task === undefined) {
      throw new BadRequestException(`Unknown task: ${dto.task}`);
    }
    if (!task.allowedKinds.includes(principal.kind)) {
      throw new ForbiddenException(`${principal.kind} may not use task: ${task.name}`);
    }

    const rate = await this.limits.checkRequestRate(principal);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const input = await validateTaskInput(task.inputDto, dto.input);

    // Checked before the model call; real usage is only added after it
    // succeeds (see RateLimitService / addUsage for why a slight overshoot
    // here is fine).
    const budget = await this.limits.checkTokenBudget(principal);
    if (!budget.allowed) {
      throw new HttpException('Daily AI usage budget exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const result = await task.run({ input, principal });
    await this.limits.addTokenUsage(
      principal,
      result.usage.inputTokens + result.usage.outputTokens,
    );

    return { task: task.name, cached: false, ...result };
  }
}
