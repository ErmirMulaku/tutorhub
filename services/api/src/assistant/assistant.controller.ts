import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Principal } from '../ai-gateway/auth/principal.js';
import { RateLimitService } from '../ai-gateway/limits/rate-limit.service.js';
import { UsageLogService, type UsageStatus } from '../ai-gateway/usage/usage-log.service.js';
import {
  AssistantService,
  type AssistantOutcome,
  type AssistantReply,
} from './assistant.service.js';
import { ChatRequestDto } from './dto/chat.dto.js';

const TASK_NAME = 'assistant_chat';
const PROMPT_VERSION = 1;

/**
 * The AI booking assistant (SPEC §12B). The model decides; the server executes.
 *
 * @deprecated Superseded by the unified `/ai/chat` tool-calling endpoint once
 * it ships (docs/UNIFIED_AI_CHAT_PLAN.md Phase 2) — kept here, unchanged in
 * contract, so the live marketplace keeps working in the meantime. The model
 * call runs on Bedrock now, and this endpoint shares its rate limit, daily
 * token budget, and usage log with `/ai/chat` rather than its own throttle.
 */
@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(
    @Inject(AssistantService) private readonly assistant: AssistantService,
    @Inject(RateLimitService) private readonly limits: RateLimitService,
    @Inject(UsageLogService) private readonly usageLog: UsageLogService,
  ) {}

  @Post('chat')
  @ApiOkResponse({ description: 'The assistant reply and the tools it invoked.' })
  async chat(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AssistantReply> {
    const principal: Principal = { id: user.studentId, kind: 'student' };
    const requestId = randomUUID();
    const startedAt = Date.now();

    const rate = await this.limits.checkRequestRate(principal);
    if (!rate.allowed) {
      this.recordOutcome(requestId, principal, startedAt, 'rate_limited');
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const budget = await this.limits.checkTokenBudget(principal);
    if (!budget.allowed) {
      this.recordOutcome(requestId, principal, startedAt, 'rate_limited');
      throw new HttpException('Daily AI usage budget exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    let outcome: AssistantOutcome;
    try {
      outcome = await this.assistant.chat(dto.messages, user.studentId);
    } catch (err) {
      this.recordOutcome(requestId, principal, startedAt, 'error');
      throw err;
    }

    await this.limits.addTokenUsage(
      principal,
      outcome.usage.inputTokens + outcome.usage.outputTokens,
    );
    this.recordOutcome(requestId, principal, startedAt, 'ok', outcome);

    return { reply: outcome.reply, toolsUsed: outcome.toolsUsed, actions: outcome.actions };
  }

  /** Same audit trail as `/ai/chat` — never stores prompt/answer text. */
  private recordOutcome(
    requestId: string,
    principal: Principal,
    startedAt: number,
    status: UsageStatus,
    outcome?: AssistantOutcome,
  ): void {
    const usage = outcome?.usage ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    this.usageLog.record({
      requestId,
      principalKind: principal.kind,
      principalId: principal.id,
      task: TASK_NAME,
      model: outcome?.model ?? null,
      promptVersion: PROMPT_VERSION,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
      latencyMs: Date.now() - startedAt,
      cacheHit: false,
      status,
    });
  }
}
