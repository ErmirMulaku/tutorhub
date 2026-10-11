/** Cosine similarity: 1 = identical direction, 0 = orthogonal, -1 = opposite. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must be the same length.');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    // Safe: the length check above guarantees index i exists in both arrays.
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ScoredItem<T> {
  item: T;
  score: number;
}

/** The `k` items most similar to `query`, highest score first. */
export function topK<T>(
  query: number[],
  items: T[],
  k: number,
  embeddingOf: (item: T) => number[],
): ScoredItem<T>[] {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, embeddingOf(item)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
