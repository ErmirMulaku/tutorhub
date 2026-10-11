import type { HelpArticle } from './articles.js';

/**
 * Sliding-window word chunker. Splits `text` into chunks of `maxWords`
 * words, each overlapping the previous chunk by `overlapWords` words so a
 * fact split across a chunk boundary still appears whole in at least one
 * chunk. The last chunk is whatever's left (no padding).
 */
export function chunkText(text: string, maxWords: number, overlapWords: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const step = Math.max(1, maxWords - overlapWords);
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(start + maxWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) {
      break;
    }
  }
  return chunks;
}

export interface ArticleChunk {
  articleId: string;
  title: string;
  chunkIndex: number;
  text: string;
}

const CHUNK_MAX_WORDS = 160;
const CHUNK_OVERLAP_WORDS = 30;

/** Chunks one help article's body into ~120-200 word chunks (~1 sentence overlap). */
export function chunkArticle(article: HelpArticle): ArticleChunk[] {
  return chunkText(article.body, CHUNK_MAX_WORDS, CHUNK_OVERLAP_WORDS).map((text, chunkIndex) => ({
    articleId: article.id,
    title: article.title,
    chunkIndex,
    text,
  }));
}
