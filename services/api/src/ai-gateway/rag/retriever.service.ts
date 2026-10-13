import { QueryVectorsCommand, S3VectorsClient } from '@aws-sdk/client-s3vectors';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LruCache } from '../cache/lru-cache.js';
import { EmbeddingsService } from './embeddings.service.js';

/** Same question asked repeatedly shouldn't re-embed every time. */
const EMBEDDING_CACHE_CAPACITY = 500;

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
  private readonly embeddingCache = new LruCache<string, number[]>(EMBEDDING_CACHE_CAPACITY);

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
  ) {
    this.client = new S3VectorsClient({
      region: config.getOrThrow<string>('AWS_REGION'),
    });
    this.bucket = config.getOrThrow<string>('S3_VECTOR_BUCKET');
    this.index = config.getOrThrow<string>('S3_VECTOR_INDEX');
  }

  async search(question: string, k = 4): Promise<RetrievedChunk[]> {
    const normalized = question.trim().toLowerCase();
    let queryEmbedding = this.embeddingCache.get(normalized);
    if (queryEmbedding === undefined) {
      queryEmbedding = await this.embeddings.embed(question);
      this.embeddingCache.set(normalized, queryEmbedding);
    }

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
      const metadata = vector.metadata as unknown as ChunkMetadata;
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
