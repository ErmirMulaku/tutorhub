import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';
import { VectorStoreService } from './vector-store.service.js';

/**
 * The RAG building blocks (embeddings + vector store), reused both by the
 * running API (via AiGatewayModule) and by the standalone ingest/eval
 * scripts (via NestFactory.createApplicationContext) — one place that
 * knows how to talk to Bedrock embeddings and S3 Vectors.
 */
@Module({
  providers: [EmbeddingsService, VectorStoreService],
  exports: [EmbeddingsService, VectorStoreService],
})
export class RagModule {}
