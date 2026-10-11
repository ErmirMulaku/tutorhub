import { randomUUID } from 'node:crypto';
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
import { MetricsService } from '../monitoring/metrics.service.js';
import { AiCacheService } from './cache/ai-cache.service.js';
import { CurrentPrincipal } from './auth/current-principal.decorator.js';
import { PrincipalGuard } from './auth/principal.guard.js';
import type { Principal } from './auth/principal.js';
import { AiChatRequestDto } from './dto/ai-chat.dto.js';
import { RateLimitService } from './limits/rate-limit.service.js';
import { TaskRegistryService, type TaskName, type TaskResult } from './tasks/task-registry.js';
import { UsageLogService, type UsageStatus } from './usage/usage-log.service.js';
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
    private readonly cache: AiCacheService,
    private readonly usageLog: UsageLogService,
    private readonly metrics: MetricsService,
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
    const requestId = randomUUID();
    res.setHeader('x-request-id', requestId);
    const startedAt = Date.now();

    const task = this.registry.get(dto.task);
    if (task === undefined) {
      throw new BadRequestException(`Unknown task: ${dto.task}`);
    }

    // Records this outcome to both the audit log (AiUsageLog) and
    // Prometheus. Never stores prompt/answer text — tokens and cost only.
    const finish = (
      status: UsageStatus,
      opts: { model?: string; cacheHit?: boolean; usage?: TaskResult['usage'] } = {},
    ): void => {
      const model = opts.model ?? 'none';
      const usage = opts.usage ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      const cacheHit = opts.cacheHit ?? false;
      const durationSeconds = (Date.now() - startedAt) / 1000;

      this.usageLog.record({
        requestId,
        principalKind: principal.kind,
        principalId: principal.id,
        task: task.name,
        model: opts.model ?? null,
        promptVersion: task.promptVersion,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: usage.costUsd,
        latencyMs: Date.now() - startedAt,
        cacheHit,
        status,
      });
      this.metrics.observeAiRequest({
        task: task.name,
        model,
        status,
        cacheHit,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: usage.costUsd,
        durationSeconds,
      });
    };

    if (!task.allowedKinds.includes(principal.kind)) {
      finish('denied');
      throw new ForbiddenException(`${principal.kind} may not use task: ${task.name}`);
    }

    const rate = await this.limits.checkRequestRate(principal);
    if (!rate.allowed) {
      finish('rate_limited');
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const input = await validateTaskInput(task.inputDto, dto.input);
    const ctx = { input, principal };

    // Cache check happens after auth/permission/rate-limit, before the
    // budget check — a cache hit doesn't call the model, so it shouldn't
    // consume budget (it still counted as a request above).
    const cacheTtl = task.cacheTtlSeconds;
    let cacheKey: string | null = null;
    if (cacheTtl !== null && task.cacheKey !== undefined) {
      cacheKey = await task.cacheKey(ctx);
    }
    if (cacheKey !== null) {
      const cached = await this.cache.getJson<TaskResult>(cacheKey);
      if (cached !== null) {
        finish('ok', { model: cached.model, cacheHit: true, usage: cached.usage });
        return { task: task.name, cached: true, ...cached };
      }
    }

    // Checked before the model call; real usage is only added after it
    // succeeds (see RateLimitService / addUsage for why a slight overshoot
    // here is fine).
    const budget = await this.limits.checkTokenBudget(principal);
    if (!budget.allowed) {
      finish('rate_limited');
      throw new HttpException('Daily AI usage budget exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    let result: TaskResult;
    try {
      result = await task.run(ctx);
    } catch (err) {
      finish('error');
      throw err;
    }

    await this.limits.addTokenUsage(
      principal,
      result.usage.inputTokens + result.usage.outputTokens,
    );
    if (cacheKey !== null && cacheTtl !== null) {
      await this.cache.set(cacheKey, result, cacheTtl);
    }
    finish('ok', { model: result.model, usage: result.usage });

    return { task: task.name, cached: false, ...result };
  }
}
