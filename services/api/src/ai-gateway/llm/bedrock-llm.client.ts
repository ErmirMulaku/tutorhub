import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
  type Message,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ContentBlock,
  ConverseMessage,
  ConverseRequest,
  ConverseResult,
  EmbedRequest,
  EmbedResult,
  LlmClient,
  StreamResult,
  StreamToken,
  ToolSpec,
} from './llm-client.js';

interface TitanEmbeddingResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

/** The only file in the repo allowed to import `@aws-sdk/client-bedrock-runtime`. */
@Injectable()
export class BedrockLlmClient implements LlmClient {
  private readonly client: BedrockRuntimeClient;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
  }

  async converse(req: ConverseRequest): Promise<ConverseResult> {
    const response = await this.client.send(
      new ConverseCommand({
        modelId: req.modelId,
        system: [{ text: req.system }],
        messages: req.messages.map(toBedrockMessage),
        inferenceConfig: {
          maxTokens: req.maxOutputTokens,
          temperature: req.temperature,
        },
      }),
      { abortSignal: req.signal },
    );

    const { text } = splitContent(response.output?.message?.content ?? []);
    return {
      text,
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
        messages: req.messages.map(toBedrockMessage),
        inferenceConfig: {
          maxTokens: req.maxOutputTokens,
          temperature: req.temperature,
        },
        toolConfig: toToolConfig(req.tools),
      }),
      { abortSignal: req.signal },
    );

    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason = 'end_turn';
    // Keyed by contentBlockIndex — a toolUse block's `input` arrives as a
    // stream of partial JSON chunks that only parse once complete.
    const toolUseById = new Map<number, { id: string; name: string; inputJson: string }>();

    for await (const event of response.stream ?? []) {
      const start = event.contentBlockStart;
      if (start?.start?.toolUse !== undefined && start.contentBlockIndex !== undefined) {
        toolUseById.set(start.contentBlockIndex, {
          id: start.start.toolUse.toolUseId ?? '',
          name: start.start.toolUse.name ?? '',
          inputJson: '',
        });
      }

      const delta = event.contentBlockDelta;
      if (delta?.delta?.text !== undefined) {
        yield { kind: 'text', text: delta.delta.text };
      }
      if (delta?.delta?.toolUse?.input !== undefined && delta.contentBlockIndex !== undefined) {
        const pending = toolUseById.get(delta.contentBlockIndex);
        if (pending !== undefined) {
          pending.inputJson += delta.delta.toolUse.input;
        }
      }

      const stop = event.contentBlockStop;
      if (stop?.contentBlockIndex !== undefined) {
        const pending = toolUseById.get(stop.contentBlockIndex);
        if (pending !== undefined) {
          yield {
            kind: 'tool_use',
            id: pending.id,
            name: pending.name,
            input: parseToolInput(pending.inputJson),
          };
          toolUseById.delete(stop.contentBlockIndex);
        }
      }

      if (event.messageStop?.stopReason !== undefined) {
        stopReason = event.messageStop.stopReason;
      }
      if (event.metadata?.usage !== undefined) {
        inputTokens = event.metadata.usage.inputTokens ?? 0;
        outputTokens = event.metadata.usage.outputTokens ?? 0;
      }
    }

    return { inputTokens, outputTokens, stopReason };
  }

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    const response = await this.client.send(
      new InvokeModelCommand({
        modelId: req.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ inputText: req.text, dimensions: 1024, normalize: true }),
      }),
    );
    const payload = JSON.parse(new TextDecoder().decode(response.body)) as TitanEmbeddingResponse;
    return { embedding: payload.embedding, inputTokens: payload.inputTextTokenCount };
  }
}

type BedrockContentBlock =
  | { text: string }
  | { toolUse: { toolUseId: string; name: string; input: Record<string, unknown> } }
  | { toolResult: { toolUseId: string; content: { text: string }[]; status: 'success' | 'error' } };

// The SDK's generated `Message`/`Tool` types are exclusive unions that
// require a `$unknown` fallback member TS can't infer for a plain object
// literal — these casts are a trusted wire-format boundary, not an escape
// from the (fully-typed) shapes constructed just above.
function toBedrockMessage(message: ConverseMessage): Message {
  return {
    role: message.role,
    content: toBedrockContent(message.content) as unknown as Message['content'],
  };
}

function toBedrockContent(content: string | ContentBlock[]): BedrockContentBlock[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }
  return content.map((block): BedrockContentBlock => {
    if (block.type === 'text') {
      return { text: block.text };
    }
    if (block.type === 'toolUse') {
      return { toolUse: { toolUseId: block.id, name: block.name, input: block.input } };
    }
    return {
      toolResult: {
        toolUseId: block.toolUseId,
        content: [{ text: block.content }],
        status: block.isError === true ? 'error' : 'success',
      },
    };
  });
}

function toToolConfig(tools: ToolSpec[] | undefined): { tools: Tool[] } | undefined {
  if (tools === undefined || tools.length === 0) {
    return undefined;
  }
  return {
    tools: tools.map(
      (tool) =>
        ({
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: { json: tool.inputSchema },
          },
        }) as unknown as Tool,
    ),
  };
}

function splitContent(blocks: unknown[]): { text: string } {
  const text = blocks
    .map((block) => (block as { text?: string }).text ?? '')
    .join('')
    .trim();
  return { text };
}

function parseToolInput(json: string): Record<string, unknown> {
  if (json === '') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
