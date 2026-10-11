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
}

export interface ConverseResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

/** One turn with a model. `converseStream` (SSE) lands in Block 9. */
export interface LlmClient {
  converse(req: ConverseRequest): Promise<ConverseResult>;
}

/** DI token — `LlmClient` is an interface, so it has no class Nest can inject by type. */
export const LLM_CLIENT = 'LLM_CLIENT';
