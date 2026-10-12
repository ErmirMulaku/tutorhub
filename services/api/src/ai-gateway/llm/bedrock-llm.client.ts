import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ConverseRequest,
  ConverseResult,
  LlmClient,
  StreamResult,
  StreamToken,
} from './llm-client.js';

/** The real LLM — AWS Bedrock's Converse API. */
@Injectable()
export class BedrockLlmClient implements LlmClient {
  private readonly client: BedrockRuntimeClient;

  constructor(@Inject(ConfigService) config: ConfigService) {
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

  async *converseStream(req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult> {
    const response = await this.client.send(
      new ConverseStreamCommand({
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

    let inputTokens = 0;
    let outputTokens = 0;
    for await (const event of response.stream ?? []) {
      const delta = event.contentBlockDelta?.delta as { text?: string } | undefined;
      if (delta?.text !== undefined) {
        yield { text: delta.text };
      }
      if (event.metadata?.usage !== undefined) {
        inputTokens = event.metadata.usage.inputTokens ?? 0;
        outputTokens = event.metadata.usage.outputTokens ?? 0;
      }
    }

    return { inputTokens, outputTokens };
  }
}
