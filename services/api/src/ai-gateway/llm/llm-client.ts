export interface ConverseMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConverseRequest {
  modelId: string;
  system: string;
  messages: ConverseMessage[];
  maxOutputTokens: number;
  temperature: number;
  /** Lets the caller (ModelRouterService) cancel a call that's timed out. */
  signal?: AbortSignal;
}

export interface ConverseResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

export interface StreamToken {
  text: string;
}

export interface StreamResult {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmClient {
  converse(req: ConverseRequest): Promise<ConverseResult>;
  /** Yields tokens as they arrive; the generator's return value is the final usage. */
  converseStream(req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult>;
}

/** DI token — `LlmClient` is an interface, so it has no class Nest can inject by type. */
export const LLM_CLIENT = 'LLM_CLIENT';
