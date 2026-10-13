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
import { AiChatRequestDto, ConfirmActionDto } from './dto/ai-chat.dto.js';
import { RateLimitService } from './limits/rate-limit.service.js';
import {
  TaskRegistryService,
  type TaskDefinition,
  type TaskName,
  type TaskResult,
  type TaskStreamEvent,
} from './tasks/task-registry.js';
import { ToolRegistryService } from './tools/tool-registry.js';
import { ConfirmationService } from './confirmation/confirmation.service.js';
import { UsageLogService, type UsageStatus } from './usage/usage-log.service.js';
import { validateTaskInput } from './validate-task-input.js';

const CONFIRM_TASK_NAME = 'chat_confirm';

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
    @Inject(ToolRegistryService) private readonly tools: ToolRegistryService,
    @Inject(ConfirmationService) private readonly confirmations: ConfirmationService,
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
    // `cacheable === false` opts a task out (e.g. a tool wrote user-specific
    // data, or a write action is pending confirmation) — absent means
    // cacheable, so help_question/summarize_conversation are unaffected.
    if (cacheKey !== null && cacheTtl !== null && result.cacheable !== false) {
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
        this.writeStreamEvent(res, next.value);
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
      if (cacheKey !== null && cacheTtl !== null && result.cacheable !== false) {
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
   * Executes a write tool the `chat` task previously asked the user to
   * confirm. The token is short-lived and single-use — but only once
   * ownership is verified: a wrong-owner attempt is rejected without
   * invalidating it, so it can't be used to lock the real owner out of
   * their own pending action. Ownership is re-checked against the caller's
   * own JWT principal, never trusted from the token's payload alone, and
   * RBAC is re-checked against the tool's `allowedKinds` — the same two
   * checks a normal tool call gets, done again here because execution
   * happens in a separate request from the one that proposed it.
   *
   * No model call here, so no rate limit / token budget / usage-log tokens —
   * only a pass/fail audit row. A tool execution failure (e.g. the booking
   * isn't the caller's) is a normal `{ok: false}` response, not an HTTP error
   * — same convention as every other tool result in this subsystem.
   */
  @Post('chat/confirm')
  @ApiOkResponse({ description: 'Executes a previously-proposed write action.' })
  async confirm(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ConfirmActionDto,
  ): Promise<{ ok: boolean; toolName: string; result: unknown }> {
    const requestId = randomUUID();
    const startedAt = Date.now();

    const pending = await this.confirmations.get(dto.token);
    if (pending === null) {
      throw new BadRequestException('This confirmation has expired or was already used.');
    }
    // Ownership/RBAC are checked before invalidating — a wrong-owner probe
    // must not burn the real owner's only chance to confirm their action.
    if (pending.principalKind !== principal.kind || pending.principalId !== principal.id) {
      throw new ForbiddenException('This confirmation does not belong to you.');
    }
    const tool = this.tools.get(pending.toolName);
    if (tool === undefined || !tool.allowedKinds.includes(principal.kind)) {
      throw new ForbiddenException(`${principal.kind} may not run tool: ${pending.toolName}`);
    }
    await this.confirmations.invalidate(dto.token);

    let result: unknown;
    try {
      result = await tool.execute(principal, pending.args);
    } catch (err) {
      result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
    }
    const ok = !(typeof result === 'object' && result !== null && 'error' in result);

    this.usageLog.record({
      requestId,
      principalKind: principal.kind,
      principalId: principal.id,
      task: CONFIRM_TASK_NAME,
      model: null,
      promptVersion: 1,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      cacheHit: false,
      status: ok ? 'ok' : 'error',
    });

    return { ok, toolName: pending.toolName, result };
  }

  /** Translates one gateway-level stream event into its documented SSE line. */
  private writeStreamEvent(res: Response, event: TaskStreamEvent): void {
    switch (event.kind) {
      case 'text':
        res.write(`data: ${JSON.stringify({ token: event.text })}\n\n`);
        return;
      case 'tool_call':
        res.write(`data: ${JSON.stringify({ tool_call: { name: event.name } })}\n\n`);
        return;
      case 'tool_result':
        res.write(
          `data: ${JSON.stringify({ tool_result: { name: event.name, ok: event.ok } })}\n\n`,
        );
        return;
      case 'confirmation_required':
        res.write(
          `data: ${JSON.stringify({
            confirmation_required: {
              token: event.token,
              toolName: event.toolName,
              summary: event.summary,
            },
          })}\n\n`,
        );
        return;
      case 'citations':
        res.write(`data: ${JSON.stringify({ citations: event.sources })}\n\n`);
        return;
      case 'tool_use':
        // Model-level primitive — a task's runStream translates this into
        // `tool_call`/`tool_result`/`confirmation_required` itself before
        // yielding, so the controller should never see it directly.
        return;
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
