import type { ConfigService } from '@nestjs/config';

/**
 * `[primary, fallback]` Bedrock model ids from config (rule: model ids are
 * config, never hard-coded). Falls back to placeholder ids so the gateway
 * boots with the stub LLM before `BEDROCK_PRIMARY_MODEL_ID` is set — Block 4
 * is what actually calls Bedrock with these.
 */
export function modelChainFrom(config: ConfigService): [string, ...string[]] {
  const primary = config.get<string>('BEDROCK_PRIMARY_MODEL_ID', 'stub-primary-model');
  const fallback = config.get<string>('BEDROCK_FALLBACK_MODEL_ID');
  return fallback === undefined || fallback === '' ? [primary] : [primary, fallback];
}
