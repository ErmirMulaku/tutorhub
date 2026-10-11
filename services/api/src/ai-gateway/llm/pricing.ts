export interface ModelPrice {
  /** $ per 1M input tokens. */
  in: number;
  /** $ per 1M output tokens. */
  out: number;
}

/** Parses `AI_MODEL_PRICES_JSON`. Malformed JSON is treated as "no prices configured". */
export function parseModelPrices(json: string): Record<string, ModelPrice> {
  try {
    return JSON.parse(json) as Record<string, ModelPrice>;
  } catch {
    return {};
  }
}

/** `0` for a model with no configured price, with a warning — never throws. */
export function costUsd(
  prices: Record<string, ModelPrice>,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = prices[modelId];
  if (price === undefined) {
    console.warn(`[ai-gateway] No price configured for model "${modelId}" — costUsd will be 0.`);
    return 0;
  }
  return (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out;
}
