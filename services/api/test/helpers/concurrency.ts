/**
 * Helpers for race tests. A race only shows up against a real database, so
 * these fire real calls at the same time and count how each one ended.
 */

/**
 * Starts `n` calls of `fn` at once (no `await` between them) and waits for all
 * of them, keeping failures instead of stopping at the first one.
 */
export function fireInParallel<T>(
  n: number,
  fn: (index: number) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(Array.from({ length: n }, (_, index) => fn(index)));
}

export interface Outcomes {
  fulfilled: number;
  /** Rejections grouped by error code, e.g. `{ SLOT_UNAVAILABLE: 19 }`. */
  rejected: Record<string, number>;
}

/**
 * Counts fulfilled results and groups rejections by code. The code is the
 * error's `code` field (our domain errors) or, failing that, its `name`.
 */
export function countOutcomes<T>(results: PromiseSettledResult<T>[]): Outcomes {
  const outcomes: Outcomes = { fulfilled: 0, rejected: {} };
  for (const result of results) {
    if (result.status === 'fulfilled') {
      outcomes.fulfilled += 1;
      continue;
    }
    const code = errorCode(result.reason);
    outcomes.rejected[code] = (outcomes.rejected[code] ?? 0) + 1;
  }
  return outcomes;
}

function errorCode(reason: unknown): string {
  if (reason instanceof Error) {
    const code = (reason as Error & { code?: unknown }).code;
    return typeof code === 'string' ? code : reason.name;
  }
  return String(reason);
}
