import { QueryVectorsCommand, S3VectorsClient } from '@aws-sdk/client-s3vectors';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from './embeddings.service.js';

export interface RetrievedChunk {
  articleId: string;
  title: string;
  chunkIndex: number;
  text: string;
  distance: number;
}

interface ChunkMetadata {
  articleId: string;
  title: string;
  chunkIndex: number;
  text: string;
}

/** Embeds a question and finds the `k` closest help-article chunks in S3 Vectors. */
@Injectable()
export class RetrieverService {
  private readonly client: S3VectorsClient;
  private readonly bucket: string;
  private readonly index: string;

  constructor(
    config: ConfigService,
    private readonly embeddings: EmbeddingsService,
  ) {
    this.client = new S3VectorsClient({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.bucket = config.getOrThrow<string>('S3_VECTOR_BUCKET');
    this.index = config.getOrThrow<string>('S3_VECTOR_INDEX');
  }

  async search(question: string, k = 4): Promise<RetrievedChunk[]> {
    const queryEmbedding = await this.embeddings.embed(question);
    const response = await this.client.send(
      new QueryVectorsCommand({
        vectorBucketName: this.bucket,
        indexName: this.index,
        queryVector: { float32: queryEmbedding },
        topK: k,
        returnMetadata: true,
        returnDistance: true,
      }),
    );

    return (response.vectors ?? []).map((vector) => {
      const metadata = vector.metadata as ChunkMetadata;
      return {
        articleId: metadata.articleId,
        title: metadata.title,
        chunkIndex: metadata.chunkIndex,
        text: metadata.text,
        distance: vector.distance ?? Infinity,
      };
    });
  }
}
