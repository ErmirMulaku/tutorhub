export interface WithRetryOptions {
  attempts: number;
  baseMs: number;
  isRetryable: (err: unknown) => boolean;
}

/**
 * Calls `fn`, retrying on retryable failures with exponential backoff +
 * jitter (`baseMs * 2^attempt + random(0-100ms)`). A non-retryable error,
 * or running out of attempts, rethrows immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === opts.attempts - 1;
      if (isLastAttempt || !opts.isRetryable(err)) {
        throw err;
      }
      const backoffMs = opts.baseMs * 2 ** attempt + Math.random() * 100;
      await sleep(backoffMs);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
