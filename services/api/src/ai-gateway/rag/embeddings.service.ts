import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelRouterService } from '../llm/model-router.service.js';

/**
 * Titan Text Embeddings V2 — turns text into a 1024-dim normalized vector.
 * Goes through `ModelRouterService` (retry/backoff), which goes through
 * `BedrockLlmClient` — the only file that imports the Bedrock runtime SDK.
 */
@Injectable()
export class EmbeddingsService {
  private readonly modelChain: string[];

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(ModelRouterService) private readonly router: ModelRouterService,
  ) {
    this.modelChain = [
      config.get<string>('BEDROCK_EMBED_MODEL_ID', 'amazon.titan-embed-text-v2:0'),
    ];
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.router.embed(this.modelChain, text);
    return result.embedding;
  }
}
