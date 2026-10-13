import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from '@jest/globals';
import type {
  ConverseRequest,
  ConverseResult,
  EmbedRequest,
  EmbedResult,
  LlmClient,
  StreamResult,
  StreamToken,
} from '../llm-client.js';
import { ModelRouterService } from '../model-router.service.js';

const config = { get: () => '{}' } as unknown as ConfigService;

function throttling(): Error {
  const err = new Error('throttled');
  err.name = 'ThrottlingException';
  return err;
}

/** Scriptable fake `LlmClient` — queues of per-model responses (error or success). */
class FakeLlm implements LlmClient {
  converseCalls: string[] = [];
  streamCalls: string[] = [];
  embedCalls: string[] = [];
  /** modelId -> queue of results; an Error entry rejects. */
  converseScript: Record<string, (ConverseResult | Error)[]> = {};
  streamScript: Record<string, (StreamToken | Error)[]> = {};
  streamResult: Record<string, StreamResult> = {};
  embedScript: Record<string, (EmbedResult | Error)[]> = {};

  converse(req: ConverseRequest): Promise<ConverseResult> {
    this.converseCalls.push(req.modelId);
    const next = this.converseScript[req.modelId]?.shift();
    if (next === undefined) throw new Error(`FakeLlm: no script left for ${req.modelId}`);
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }

  async *converseStream(req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult> {
    await Promise.resolve();
    this.streamCalls.push(req.modelId);
    const queue = this.streamScript[req.modelId] ?? [];
    for (const item of queue) {
      if (item instanceof Error) throw item;
      yield item;
    }
    return (
      this.streamResult[req.modelId] ?? { inputTokens: 1, outputTokens: 1, stopReason: 'end_turn' }
    );
  }

  embed(req: EmbedRequest): Promise<EmbedResult> {
    this.embedCalls.push(req.modelId);
    const next = this.embedScript[req.modelId]?.shift();
    if (next === undefined) throw new Error(`FakeLlm: no script left for ${req.modelId}`);
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }
}

function makeRouter(llm: FakeLlm): ModelRouterService {
  return new ModelRouterService(llm, config);
}

const baseRequest = { system: 's', messages: [], maxOutputTokens: 100, temperature: 0 };

describe('ModelRouterService.run', () => {
  it('retries a retryable error and succeeds on a later attempt, same model', async () => {
    const llm = new FakeLlm();
    llm.converseScript['m1'] = [
      throttling(),
      { text: 'ok', inputTokens: 1, outputTokens: 1, modelId: 'm1' },
    ];
    const router = makeRouter(llm);

    const result = await router.run(['m1', 'm2'], baseRequest);

    expect(result.text).toBe('ok');
    expect(result.modelId).toBe('m1');
    expect(llm.converseCalls).toEqual(['m1', 'm1']);
  }, 10_000);

  it('falls back to the next model once the first exhausts its retries', async () => {
    const llm = new FakeLlm();
    llm.converseScript['m1'] = [throttling(), throttling(), throttling()];
    llm.converseScript['m2'] = [
      { text: 'from m2', inputTokens: 1, outputTokens: 1, modelId: 'm2' },
    ];
    const router = makeRouter(llm);

    const result = await router.run(['m1', 'm2'], baseRequest);

    expect(result.text).toBe('from m2');
    expect(result.modelId).toBe('m2');
    expect(llm.converseCalls.filter((m) => m === 'm1')).toHaveLength(3);
  }, 10_000);

  it('throws a clean 503 when every model in the chain fails', async () => {
    const llm = new FakeLlm();
    llm.converseScript['m1'] = [throttling(), throttling(), throttling()];
    llm.converseScript['m2'] = [throttling(), throttling(), throttling()];
    const router = makeRouter(llm);

    await expect(router.run(['m1', 'm2'], baseRequest)).rejects.toThrow(
      ServiceUnavailableException,
    );
  }, 10_000);

  it('skips straight to the next model on a non-retryable error (no wasted retries)', async () => {
    const llm = new FakeLlm();
    const badRequest = new Error('bad request');
    badRequest.name = 'ValidationException';
    llm.converseScript['m1'] = [badRequest];
    llm.converseScript['m2'] = [{ text: 'ok', inputTokens: 1, outputTokens: 1, modelId: 'm2' }];
    const router = makeRouter(llm);

    const result = await router.run(['m1', 'm2'], baseRequest);

    expect(result.modelId).toBe('m2');
    expect(llm.converseCalls.filter((m) => m === 'm1')).toHaveLength(1);
  });
});

describe('ModelRouterService.runStream', () => {
  it('falls back to the next model when the first fails before any token', async () => {
    const llm = new FakeLlm();
    llm.streamScript['m1'] = [throttling()];
    llm.streamScript['m2'] = [{ kind: 'text', text: 'hi' }];
    llm.streamResult['m2'] = { inputTokens: 2, outputTokens: 2, stopReason: 'end_turn' };
    const router = makeRouter(llm);

    const stream = router.runStream(['m1', 'm2'], baseRequest);
    const tokens: StreamToken[] = [];
    let next = await stream.next();
    while (!next.done) {
      tokens.push(next.value);
      next = await stream.next();
    }

    expect(tokens).toEqual([{ kind: 'text', text: 'hi' }]);
    expect(next.value.modelId).toBe('m2');
  });

  it('rethrows (does not fall back) once a token was already sent', async () => {
    const llm = new FakeLlm();
    const midStreamError = new Error('dropped connection');
    llm.streamScript['m1'] = [{ kind: 'text', text: 'partial' }, midStreamError];
    llm.streamScript['m2'] = [{ kind: 'text', text: 'should not be reached' }];
    const router = makeRouter(llm);

    const stream = router.runStream(['m1', 'm2'], baseRequest);
    const first = await stream.next();
    expect(first.value).toEqual({ kind: 'text', text: 'partial' });

    await expect(stream.next()).rejects.toThrow('dropped connection');
    expect(llm.streamCalls).toEqual(['m1']);
  });

  it('throws a clean 503 when every model fails before a token', async () => {
    const llm = new FakeLlm();
    llm.streamScript['m1'] = [throttling()];
    llm.streamScript['m2'] = [throttling()];
    const router = makeRouter(llm);

    const stream = router.runStream(['m1', 'm2'], baseRequest);
    await expect(stream.next()).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('ModelRouterService.embed', () => {
  it('retries a retryable error and succeeds', async () => {
    const llm = new FakeLlm();
    llm.embedScript['embed-1'] = [throttling(), { embedding: [1, 2, 3], inputTokens: 4 }];
    const router = makeRouter(llm);

    const result = await router.embed(['embed-1'], 'hello');

    expect(result.embedding).toEqual([1, 2, 3]);
    expect(result.modelId).toBe('embed-1');
    expect(llm.embedCalls).toEqual(['embed-1', 'embed-1']);
  }, 10_000);
});
