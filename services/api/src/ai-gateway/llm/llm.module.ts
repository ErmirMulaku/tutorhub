import { Module } from '@nestjs/common';
import { BedrockLlmClient } from './bedrock-llm.client.js';
import { LLM_CLIENT } from './llm-client.js';
import { ModelRouterService } from './model-router.service.js';

/**
 * The single Bedrock entry point: `BedrockLlmClient` is the only class that
 * imports the AWS Bedrock runtime SDK, and `ModelRouterService` is the only
 * way anything calls it (retry, model-chain fallback, cost accounting).
 * Shared by `AiGatewayModule` (chat tasks) and `RagModule` (embeddings) —
 * and, through `RagModule`, by the standalone ingest/eval scripts too.
 */
@Module({
  providers: [ModelRouterService, { provide: LLM_CLIENT, useClass: BedrockLlmClient }],
  exports: [ModelRouterService],
})
export class LlmModule {}
