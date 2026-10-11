import { Injectable } from '@nestjs/common';
import type {
  ConverseRequest,
  ConverseResult,
  LlmClient,
  StreamResult,
  StreamToken,
} from './llm-client.js';

/**
 * Canned {@link LlmClient} with no network call, so the gateway's plumbing
 * (registry → controller → task) can be built and tested without hitting
 * Bedrock.
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

  async *converseStream(req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult> {
    const question = req.messages.at(-1)?.content ?? '';
    const text = `This is a stub answer. You asked: "${question}"`;
    for (const word of text.split(' ')) {
      await Promise.resolve();
      yield { text: `${word} ` };
    }
    return { inputTokens: Math.ceil(question.length / 4), outputTokens: 12 };
  }
}
