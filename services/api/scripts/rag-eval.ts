/**
 * Runs 10 in-scope questions (each with an expected articleId) plus 2
 * out-of-scope questions through RetrieverService (the real S3 Vectors
 * path), and separately re-embeds every chunk to double-check topK
 * locally with cosineSimilarity/topK. Prints hit@4 per question and the
 * totals — use this to calibrate RAG_MAX_DISTANCE.
 *
 *   npm run rag:eval
 */
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { loadHelpArticles } from '../src/ai-gateway/rag/articles.js';
import { chunkArticle } from '../src/ai-gateway/rag/chunker.js';
import { EmbeddingsService } from '../src/ai-gateway/rag/embeddings.service.js';
import { promisePool } from '../src/ai-gateway/rag/promise-pool.js';
import { RagModule } from '../src/ai-gateway/rag/rag.module.js';
import { RetrieverService } from '../src/ai-gateway/rag/retriever.service.js';
import { topK } from '../src/ai-gateway/rag/similarity.js';

interface EvalCase {
  question: string;
  expectedArticleId: string;
}

const IN_SCOPE: EvalCase[] = [
  {
    question: 'Can I cancel 2 hours before my lesson without losing money?',
    expectedArticleId: 'cancellation-policy',
  },
  {
    question: 'How do I move my lesson to a different time?',
    expectedArticleId: 'rescheduling',
  },
  {
    question: 'How long does it take to get my refund back on my card?',
    expectedArticleId: 'refunds',
  },
  {
    question: 'Can I use my wallet balance to pay for a lesson?',
    expectedArticleId: 'payment-methods',
  },
  { question: 'How do I redeem a TutorHub gift card?', expectedArticleId: 'gift-cards' },
  { question: 'Can I withdraw my wallet balance as cash?', expectedArticleId: 'wallet' },
  {
    question: 'How do I apply to become a tutor on TutorHub?',
    expectedArticleId: 'becoming-a-tutor',
  },
  {
    question: 'When do tutors receive payment for completed lessons?',
    expectedArticleId: 'tutor-payouts',
  },
  { question: 'Can a tutor delete a review a student left?', expectedArticleId: 'reviews' },
  {
    question: 'Does TutorHub store my credit card number?',
    expectedArticleId: 'account-and-privacy',
  },
];

const OUT_OF_SCOPE = [
  'What is the capital of France?',
  "What's the weather like tomorrow in Paris?",
];

const EMBED_CONCURRENCY = 3;

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), RagModule] })
class EvalModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(EvalModule, { logger: false });
  const embeddings = app.get(EmbeddingsService);
  const retriever = app.get(RetrieverService);
  const config = app.get(ConfigService);
  const maxDistance = Number(config.get<string>('RAG_MAX_DISTANCE', '0.6'));

  const articles = await loadHelpArticles();
  const chunks = articles.flatMap((article) => chunkArticle(article));
  const localChunks = await promisePool(chunks, EMBED_CONCURRENCY, async (chunk) => ({
    ...chunk,
    embedding: await embeddings.embed(chunk.text),
  }));

  let hits = 0;
  for (const testCase of IN_SCOPE) {
    const questionEmbedding = await embeddings.embed(testCase.question);
    const local = topK(questionEmbedding, localChunks, 4, (c) => c.embedding);
    const localHit = local.some((r) => r.item.articleId === testCase.expectedArticleId);

    const remote = await retriever.search(testCase.question, 4);
    const remoteHit = remote.some((r) => r.articleId === testCase.expectedArticleId);

    if (remoteHit) {
      hits++;
    }
    const status = remoteHit ? 'HIT ' : 'MISS';
    const disagreement = localHit === remoteHit ? '' : '  (local topK disagrees!)';
    console.log(`${status} [${testCase.expectedArticleId}] "${testCase.question}"${disagreement}`);
  }
  console.log(`\nhit@4: ${hits}/${IN_SCOPE.length} (target >= 8/10)\n`);

  let correctlyUnanswered = 0;
  for (const question of OUT_OF_SCOPE) {
    const remote = await retriever.search(question, 4);
    const bestDistance = remote[0]?.distance ?? Infinity;
    const wouldSayDontKnow = bestDistance > maxDistance;
    if (wouldSayDontKnow) {
      correctlyUnanswered++;
    }
    console.log(
      `${wouldSayDontKnow ? 'OK  ' : 'FAIL'} "${question}" ` +
        `best distance=${bestDistance.toFixed(3)} (RAG_MAX_DISTANCE=${maxDistance})`,
    );
  }
  console.log(
    `\nout-of-scope correctly unanswered: ${correctlyUnanswered}/${OUT_OF_SCOPE.length}\n`,
  );

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
