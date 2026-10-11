import { PutVectorsCommand, S3VectorsClient } from '@aws-sdk/client-s3vectors';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisePool } from './promise-pool.js';
import type { ArticleChunk } from './chunker.js';

export interface EmbeddedChunk extends ArticleChunk {
  embedding: number[];
}

/** Comfortably under S3 Vectors' per-request vector count limit. */
const PUT_BATCH_SIZE = 25;
/** How many PutVectors batches run at once. */
const PUT_CONCURRENCY = 3;

/** S3 Vectors — the index backing help-center semantic search. */
@Injectable()
export class VectorStoreService {
  private readonly client: S3VectorsClient;
  private readonly bucket: string;
  private readonly index: string;

  constructor(config: ConfigService) {
    this.client = new S3VectorsClient({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.bucket = config.getOrThrow<string>('S3_VECTOR_BUCKET');
    this.index = config.getOrThrow<string>('S3_VECTOR_INDEX');
  }

  /**
   * Writes chunks keyed by `${articleId}#${chunkIndex}`. Re-ingesting the
   * same article overwrites its vectors in place (same keys) rather than
   * creating duplicates.
   */
  async put(chunks: EmbeddedChunk[]): Promise<void> {
    const batches = batch(chunks, PUT_BATCH_SIZE);
    await promisePool(batches, PUT_CONCURRENCY, (batchChunks) => this.putBatch(batchChunks));
  }

  private async putBatch(chunks: EmbeddedChunk[]): Promise<void> {
    await this.client.send(
      new PutVectorsCommand({
        vectorBucketName: this.bucket,
        indexName: this.index,
        vectors: chunks.map((chunk) => ({
          key: `${chunk.articleId}#${chunk.chunkIndex}`,
          data: { float32: chunk.embedding },
          metadata: {
            articleId: chunk.articleId,
            title: chunk.title,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
          },
        })),
      }),
    );
  }
}

function batch<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
