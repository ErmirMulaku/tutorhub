import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConverseRequest, ConverseResult, LlmClient } from './llm-client.js';

/** The real LLM — AWS Bedrock's Converse API. */
@Injectable()
export class BedrockLlmClient implements LlmClient {
  private readonly client: BedrockRuntimeClient;

  constructor(config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async converse(req: ConverseRequest): Promise<ConverseResult> {
    const response = await this.client.send(
      new ConverseCommand({
        modelId: req.modelId,
        system: [{ text: req.system }],
        messages: req.messages.map((message) => ({
          role: message.role,
          content: [{ text: message.content }],
        })),
        inferenceConfig: {
          maxTokens: req.maxOutputTokens,
          temperature: req.temperature,
        },
      }),
      { abortSignal: req.signal },
    );

    return {
      text: response.output?.message?.content?.[0]?.text ?? '',
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      modelId: req.modelId,
    };
  }
}
