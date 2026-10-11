import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TitanEmbeddingResponse {
  embedding: number[];
}

/** Titan Text Embeddings V2 — turns text into a 1024-dim normalized vector. */
@Injectable()
export class EmbeddingsService {
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.modelId = config.get<string>('BEDROCK_EMBED_MODEL_ID', 'amazon.titan-embed-text-v2:0');
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.send(
      new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
      }),
    );
    const payload = JSON.parse(new TextDecoder().decode(response.body)) as TitanEmbeddingResponse;
    return payload.embedding;
  }
}
