import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runWithFallback } from './fallback.js';
import {
  LLM_CLIENT,
  type ConverseRequest,
  type ConverseResult,
  type LlmClient,
  type StreamToken,
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

export interface RouterStreamResult {
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
    @Inject(ConfigService) config: ConfigService,
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

  /**
   * Streaming counterpart to {@link run}. No retry/backoff here — once a
   * model starts sending tokens, we're committed to it (the caller may
   * already have forwarded tokens to a client). Fallback to the next model
   * in `modelChain` only happens if a model fails before its first token.
   *
   * `externalSignal` lets the caller (the SSE controller, on `res.on('close')`)
   * cancel the in-flight Bedrock call so a disconnected client stops costing money.
   */
  async *runStream(
    modelChain: string[],
    request: RouterRequest,
    externalSignal?: AbortSignal,
  ): AsyncGenerator<StreamToken, RouterStreamResult> {
    let lastError: unknown;

    for (const modelId of modelChain) {
      let sentFirstToken = false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const onExternalAbort = (): void => controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort);

      try {
        const stream = this.llm.converseStream({ ...request, modelId, signal: controller.signal });
        let next = await stream.next();
        while (!next.done) {
          sentFirstToken = true;
          yield next.value;
          next = await stream.next();
        }
        const { inputTokens, outputTokens } = next.value;
        return {
          modelId,
          inputTokens,
          outputTokens,
          costUsd: costUsd(this.prices, modelId, inputTokens, outputTokens),
        };
      } catch (err) {
        lastError = err;
        if (sentFirstToken) {
          throw err;
        }
      } finally {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }
    }

    throw lastError;
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
