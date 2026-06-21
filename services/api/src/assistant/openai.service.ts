import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

/**
 * Thin wrapper around the OpenAI client — the single seam the assistant uses to
 * reach the model, and the one place tests mock. The API key is read from the
 * server environment and never leaves it (SPEC §12B).
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI | null;
  readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.model = config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY not set — the booking assistant is disabled.');
    }
  }

  /** Whether a real API key is configured (else the endpoint returns 503). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** One chat-completions turn; returns the assistant message (text or tool calls). */
  async chat(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
  ): Promise<ChatCompletionMessage> {
    if (!this.client) {
      throw new Error('OpenAI client is not configured.');
    }
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: 'auto',
    });
    const choice = completion.choices[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices.');
    }
    return choice.message;
  }
}
