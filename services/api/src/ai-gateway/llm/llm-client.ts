export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'toolUse'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'toolResult'; toolUseId: string; content: string; isError?: boolean };

export interface ConverseMessage {
  role: 'user' | 'assistant';
  /** A plain string is shorthand for `[{ type: 'text', text }]`. */
  content: string | ContentBlock[];
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  inputSchema: Record<string, unknown>;
}

export interface ConverseRequest {
  modelId: string;
  system: string;
  messages: ConverseMessage[];
  maxOutputTokens: number;
  temperature: number;
  /** Only honored by `converseStream` — the text-only `converse` callers never set this. */
  tools?: ToolSpec[];
  /** Lets the caller (ModelRouterService) cancel a call that's timed out. */
  signal?: AbortSignal;
}

export interface ConverseResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

export type StreamToken =
  | { kind: 'text'; text: string }
  | { kind: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

export interface StreamResult {
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export interface EmbedRequest {
  modelId: string;
  text: string;
}

export interface EmbedResult {
  embedding: number[];
  inputTokens: number;
}

export interface LlmClient {
  converse(req: ConverseRequest): Promise<ConverseResult>;
  /** Yields tokens as they arrive; the generator's return value is the final usage. */
  converseStream(req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
}

/** DI token — `LlmClient` is an interface, so it has no class Nest can inject by type. */
export const LLM_CLIENT = 'LLM_CLIENT';
