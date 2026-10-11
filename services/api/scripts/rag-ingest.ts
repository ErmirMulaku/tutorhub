/**
 * Reads every help article, chunks it, embeds each chunk, and writes the
 * result to S3 Vectors. Safe to re-run: chunks are keyed by
 * `${articleId}#${chunkIndex}`, so re-ingesting overwrites rather than
 * duplicating.
 *
 *   npm run rag:ingest
 */
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { loadHelpArticles } from '../src/ai-gateway/rag/articles.js';
import { chunkArticle } from '../src/ai-gateway/rag/chunker.js';
import { EmbeddingsService } from '../src/ai-gateway/rag/embeddings.service.js';
import { promisePool } from '../src/ai-gateway/rag/promise-pool.js';
import { RagModule } from '../src/ai-gateway/rag/rag.module.js';
import { VectorStoreService } from '../src/ai-gateway/rag/vector-store.service.js';

const EMBED_CONCURRENCY = 3;

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), RagModule] })
class IngestModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(IngestModule, { logger: false });
  const embeddings = app.get(EmbeddingsService);
  const vectorStore = app.get(VectorStoreService);

  const articles = await loadHelpArticles();
  const chunks = articles.flatMap((article) => chunkArticle(article));
  console.log(`${articles.length} articles -> ${chunks.length} chunks`);

  const embedded = await promisePool(chunks, EMBED_CONCURRENCY, async (chunk) => ({
    ...chunk,
    embedding: await embeddings.embed(chunk.text),
  }));

  await vectorStore.put(embedded);
  console.log(`Wrote ${embedded.length} vectors.`);

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
