import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export type UsageStatus = 'ok' | 'denied' | 'rate_limited' | 'error';

export interface UsageLogEntry {
  requestId: string;
  principalKind: string;
  principalId: string;
  task: string;
  model: string | null;
  promptVersion: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  status: UsageStatus;
}

/**
 * Writes one audit row per `/ai/chat` call. Never stores prompt or answer
 * text (PII) — tokens and cost only. Fire-and-forget on purpose: a logging
 * failure is a monitoring gap, not a reason to fail the caller's request,
 * so errors are logged here and swallowed rather than thrown.
 */
@Injectable()
export class UsageLogService {
  private readonly logger = new Logger(UsageLogService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  record(entry: UsageLogEntry): void {
    this.prisma.aiUsageLog.create({ data: entry }).catch((err: unknown) => {
      this.logger.error(
        `Failed to write AiUsageLog for request ${entry.requestId}`,
        err instanceof Error ? err.stack : String(err),
      );
    });
  }
}
