/**
 * Tries `models` in order, calling `callModel` for each. Returns the first
 * success; if every model fails, rethrows the last model's error.
 */
export async function runWithFallback<T>(
  models: string[],
  callModel: (modelId: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (const modelId of models) {
    try {
      return await callModel(modelId);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
