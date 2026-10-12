import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
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
import {
  TaskRegistryService,
  type TaskDefinition,
  type TaskName,
  type TaskResult,
} from './tasks/task-registry.js';
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
  private readonly logger = new Logger(AiGatewayController.name);

  constructor(
    @Inject(TaskRegistryService) private readonly registry: TaskRegistryService,
    @Inject(RateLimitService) private readonly limits: RateLimitService,
    @Inject(AiCacheService) private readonly cache: AiCacheService,
    @Inject(UsageLogService) private readonly usageLog: UsageLogService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
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

    if (!task.allowedKinds.includes(principal.kind)) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'denied' });
      throw new ForbiddenException(`${principal.kind} may not use task: ${task.name}`);
    }

    const rate = await this.limits.checkRequestRate(principal);
    if (!rate.allowed) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'rate_limited' });
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
        this.recordOutcome({
          requestId,
          principal,
          task,
          startedAt,
          status: 'ok',
          model: cached.model,
          cacheHit: true,
          usage: cached.usage,
        });
        return { task: task.name, cached: true, ...cached };
      }
    }

    // Checked before the model call; real usage is only added after it
    // succeeds (see RateLimitService / addUsage for why a slight overshoot
    // here is fine).
    const budget = await this.limits.checkTokenBudget(principal);
    if (!budget.allowed) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'rate_limited' });
      throw new HttpException('Daily AI usage budget exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    let result: TaskResult;
    try {
      result = await task.run(ctx);
    } catch (err) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'error' });
      throw err;
    }

    await this.limits.addTokenUsage(
      principal,
      result.usage.inputTokens + result.usage.outputTokens,
    );
    if (cacheKey !== null && cacheTtl !== null) {
      await this.cache.set(cacheKey, result, cacheTtl);
    }
    this.recordOutcome({
      requestId,
      principal,
      task,
      startedAt,
      status: 'ok',
      model: result.model,
      usage: result.usage,
    });

    return { task: task.name, cached: false, ...result };
  }

  @Post('chat/stream')
  @ApiOkResponse({ description: 'SSE: data:{"token":...} events, then data:{"done":true,...}.' })
  async chatStream(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: AiChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    const requestId = randomUUID();
    const startedAt = Date.now();

    const task = this.registry.get(dto.task);
    if (task === undefined) {
      throw new BadRequestException(`Unknown task: ${dto.task}`);
    }
    if (!task.allowedKinds.includes(principal.kind)) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'denied' });
      throw new ForbiddenException(`${principal.kind} may not use task: ${task.name}`);
    }
    if (task.runStream === undefined) {
      throw new BadRequestException(`Task ${task.name} does not support streaming.`);
    }
    // Capture bound to `task` — a destructured/reassigned reference would
    // lose its `this`, breaking the task's own dependencies (router, etc.).
    const runStream = task.runStream.bind(task);

    const rate = await this.limits.checkRequestRate(principal);
    if (!rate.allowed) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'rate_limited' });
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const input = await validateTaskInput(task.inputDto, dto.input);
    const ctx = { input, principal };

    const cacheTtl = task.cacheTtlSeconds;
    let cacheKey: string | null = null;
    if (cacheTtl !== null && task.cacheKey !== undefined) {
      cacheKey = await task.cacheKey(ctx);
    }

    // Nothing has been written yet, so a thrown exception below would still
    // produce a normal JSON error response — these headers are only staged.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('x-request-id', requestId);

    if (cacheKey !== null) {
      const cached = await this.cache.getJson<TaskResult>(cacheKey);
      if (cached !== null) {
        res.write(`data: ${JSON.stringify({ token: cached.answer })}\n\n`);
        res.write(
          `data: ${JSON.stringify({ done: true, usage: cached.usage, sources: cached.sources })}\n\n`,
        );
        res.end();
        this.recordOutcome({
          requestId,
          principal,
          task,
          startedAt,
          status: 'ok',
          model: cached.model,
          cacheHit: true,
          usage: cached.usage,
        });
        return;
      }
    }

    const budget = await this.limits.checkTokenBudget(principal);
    if (!budget.allowed) {
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'rate_limited' });
      throw new HttpException('Daily AI usage budget exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Stop paying Bedrock for tokens no one will see once the client disconnects.
    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    try {
      const stream = runStream(ctx, abortController.signal);
      let next = await stream.next();
      while (!next.done) {
        // Neither registered task passes `tools` yet, so this is always a
        // text token — the SSE contract here stays `{token}` until the
        // unified tool-calling endpoint (Phase 2) needs a richer event.
        if (next.value.kind === 'text') {
          res.write(`data: ${JSON.stringify({ token: next.value.text })}\n\n`);
        }
        next = await stream.next();
      }
      const result = next.value;

      res.write(
        `data: ${JSON.stringify({ done: true, usage: result.usage, sources: result.sources })}\n\n`,
      );
      res.end();

      await this.limits.addTokenUsage(
        principal,
        result.usage.inputTokens + result.usage.outputTokens,
      );
      if (cacheKey !== null && cacheTtl !== null) {
        await this.cache.set(cacheKey, result, cacheTtl);
      }
      this.recordOutcome({
        requestId,
        principal,
        task,
        startedAt,
        status: 'ok',
        model: result.model,
        usage: result.usage,
      });
    } catch (err) {
      this.logger.error(
        `Stream failed for request ${requestId}`,
        err instanceof Error ? err.stack : String(err),
      );
      this.recordOutcome({ requestId, principal, task, startedAt, status: 'error' });
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ done: true, error: 'AI temporarily unavailable' })}\n\n`,
        );
        res.end();
      }
    }
  }

  /**
   * Records one call's outcome to both the audit log (AiUsageLog) and
   * Prometheus. Never stores prompt/answer text — tokens and cost only.
   */
  private recordOutcome(params: {
    requestId: string;
    principal: Principal;
    task: TaskDefinition;
    startedAt: number;
    status: UsageStatus;
    model?: string;
    cacheHit?: boolean;
    usage?: TaskResult['usage'];
  }): void {
    const { requestId, principal, task, startedAt, status } = params;
    const model = params.model ?? 'none';
    const usage = params.usage ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const cacheHit = params.cacheHit ?? false;
    const durationSeconds = (Date.now() - startedAt) / 1000;

    this.usageLog.record({
      requestId,
      principalKind: principal.kind,
      principalId: principal.id,
      task: task.name,
      model: params.model ?? null,
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
  }
}
