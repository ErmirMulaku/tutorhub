import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrincipalKind } from '../../auth/auth-user.js';
import type { Principal } from '../auth/principal.js';
import { RetrieverService } from '../rag/retriever.service.js';
import type { ToolDefinition } from './tool-registry.js';

const TOP_K = 4;

export interface HelpArticleChunk {
  articleId: string;
  title: string;
  chunkIndex: number;
  text: string;
  distance: number;
}

/**
 * Read-only tool wrapping the existing RAG retrieval (the old `help_question`
 * task's retrieval step) — same `RAG_MAX_DISTANCE` "I don't know" guard, now
 * exposed to the model as a tool instead of being hard-wired into one task.
 */
@Injectable()
export class HelpArticlesTool implements ToolDefinition {
  readonly name = 'search_help_articles';
  readonly description =
    'Search TutorHub help-center articles for policy or how-to questions ' +
    '(cancellation, refunds, payment methods, gift cards, wallet, becoming a tutor, ' +
    'payouts, reviews, messaging, account/privacy). Returns matching article excerpts, ' +
    'or no result if nothing is close enough — never guess an answer without this.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: "The student or tutor's question, verbatim." },
    },
    required: ['query'],
  };
  readonly kind = 'read' as const;
  readonly allowedKinds: PrincipalKind[] = ['student', 'tutor'];
  readonly requiresConfirmation = false;
  private readonly maxDistance: number;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(RetrieverService) private readonly retriever: RetrieverService,
  ) {
    this.maxDistance = Number(config.get<string>('RAG_MAX_DISTANCE', '0.6'));
  }

  async execute(_principal: Principal, args: Record<string, unknown>): Promise<unknown> {
    const query = typeof args['query'] === 'string' ? args['query'] : '';
    if (query === '') {
      return { error: 'query is required.' };
    }
    const chunks = await this.retriever.search(query, TOP_K);
    const best = chunks[0];
    if (best === undefined || best.distance > this.maxDistance) {
      return { result: 'none' };
    }
    const result: HelpArticleChunk[] = chunks.map((chunk) => ({
      articleId: chunk.articleId,
      title: chunk.title,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      distance: chunk.distance,
    }));
    return { chunks: result };
  }
}
