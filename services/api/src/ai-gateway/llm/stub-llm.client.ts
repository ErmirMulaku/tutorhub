import { Injectable } from '@nestjs/common';
import type {
  ContentBlock,
  ConverseRequest,
  ConverseResult,
  EmbedRequest,
  EmbedResult,
  LlmClient,
  StreamResult,
  StreamToken,
} from './llm-client.js';

/** Both tasks that use this stub only ever pass a plain string. */
function contentToText(content: string | ContentBlock[] | undefined): string {
  if (content === undefined) return '';
  if (typeof content === 'string') return content;
  return content.map((block) => (block.type === 'text' ? block.text : '')).join('');
}

/**
 * Canned {@link LlmClient} with no network call, so the gateway's plumbing
 * (registry → controller → task) can be built and tested without hitting
 * Bedrock. Never emits a `tool_use` token — tasks that pass `tools` need a
 * script-aware double of their own (see `assistant.e2e-test.ts`).
 */
@Injectable()
export class StubLlmClient implements LlmClient {
  converse(req: ConverseRequest): Promise<ConverseResult> {
    const question = contentToText(req.messages.at(-1)?.content);
    return Promise.resolve({
      text: `This is a stub answer. You asked: "${question}"`,
      inputTokens: Math.ceil(question.length / 4),
      outputTokens: 12,
      modelId: req.modelId,
    });
  }

  async *converseStream(req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult> {
    const question = contentToText(req.messages.at(-1)?.content);
    const text = `This is a stub answer. You asked: "${question}"`;
    for (const word of text.split(' ')) {
      await Promise.resolve();
      yield { kind: 'text', text: `${word} ` };
    }
    return {
      inputTokens: Math.ceil(question.length / 4),
      outputTokens: 12,
      stopReason: 'end_turn',
    };
  }

  embed(req: EmbedRequest): Promise<EmbedResult> {
    const hash = [...req.text].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0);
    const embedding = Array.from({ length: 1024 }, (_, i) => Math.sin(hash + i));
    return Promise.resolve({ embedding, inputTokens: Math.ceil(req.text.length / 4) });
  }
}
