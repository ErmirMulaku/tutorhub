import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runWithFallback } from './fallback.js';
import {
  LLM_CLIENT,
  type ConverseRequest,
  type ConverseResult,
  type LlmClient,
} from './llm-client.js';
import { costUsd, parseModelPrices, type ModelPrice } from './pricing.js';
import { withRetry } from './retry.js';

const ATTEMPTS_PER_MODEL = 3;
const BASE_BACKOFF_MS = 500;
const TIMEOUT_MS = 30_000;

export interface RouterResult {
  text: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Everything a model needs except which model — the router fills that in per attempt. */
export type RouterRequest = Omit<ConverseRequest, 'modelId' | 'signal'>;

/**
 * Tries each model in `modelChain` in order, retrying transient failures
 * (throttling, 5xx, timeouts) up to 3 times per model before moving to the
 * next. A non-retryable error (bad request shape, 4xx) skips straight to
 * the next model without burning retries on it. If every model fails,
 * throws 503 — graceful degradation instead of a crash.
 */
@Injectable()
export class ModelRouterService {
  private readonly prices: Record<string, ModelPrice>;

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    config: ConfigService,
  ) {
    this.prices = parseModelPrices(config.get<string>('AI_MODEL_PRICES_JSON', '{}'));
  }

  async run(modelChain: string[], request: RouterRequest): Promise<RouterResult> {
    let result;
    try {
      result = await runWithFallback(modelChain, (modelId) =>
        withRetry(() => this.attempt(modelId, request), {
          attempts: ATTEMPTS_PER_MODEL,
          baseMs: BASE_BACKOFF_MS,
          isRetryable: isRetryableBedrockError,
        }),
      );
    } catch {
      throw new ServiceUnavailableException('AI temporarily unavailable');
    }

    return {
      text: result.text,
      modelId: result.modelId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: costUsd(this.prices, result.modelId, result.inputTokens, result.outputTokens),
    };
  }

  private attempt(modelId: string, request: RouterRequest): Promise<ConverseResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return this.llm
      .converse({ ...request, modelId, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }
}

function isRetryableBedrockError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  if (err.name === 'ThrottlingException' || err.name === 'ServiceUnavailableException') {
    return true;
  }
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return true;
  }
  const statusCode = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return typeof statusCode === 'number' && statusCode >= 500;
}
