import { Injectable } from '@nestjs/common';
import type { ConverseRequest, ConverseResult, LlmClient } from './llm-client.js';

/**
 * Canned {@link LlmClient} with no network call, so the gateway's plumbing
 * (registry → controller → task) can be built and tested before Block 4
 * wires up the real Bedrock client.
 */
@Injectable()
export class StubLlmClient implements LlmClient {
  converse(req: ConverseRequest): Promise<ConverseResult> {
    const question = req.messages.at(-1)?.content ?? '';
    return Promise.resolve({
      text: `This is a stub answer. You asked: "${question}"`,
      inputTokens: Math.ceil(question.length / 4),
      outputTokens: 12,
      modelId: req.modelId,
    });
  }
}
