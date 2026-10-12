import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MonitoringModule } from '../monitoring/monitoring.module.js';
import { AiGatewayController } from './ai-gateway.controller.js';
import { PrincipalGuard } from './auth/principal.guard.js';
import { AiCacheService } from './cache/ai-cache.service.js';
import { RateLimitService } from './limits/rate-limit.service.js';
import { RedisService } from './limits/redis.service.js';
import { LlmModule } from './llm/llm.module.js';
import { RagModule } from './rag/rag.module.js';
import { HelpQuestionTask } from './tasks/help-question.task.js';
import { SummarizeConversationTask } from './tasks/summarize-conversation.task.js';
import { AI_TASKS, TaskRegistryService, type TaskDefinition } from './tasks/task-registry.js';
import { UsageLogService } from './usage/usage-log.service.js';

@Module({
  imports: [AuthModule, RagModule, MonitoringModule, LlmModule],
  controllers: [AiGatewayController],
  providers: [
    PrincipalGuard,
    RedisService,
    RateLimitService,
    AiCacheService,
    UsageLogService,
    HelpQuestionTask,
    SummarizeConversationTask,
    {
      provide: AI_TASKS,
      useFactory: (
        helpQuestion: HelpQuestionTask,
        summarizeConversation: SummarizeConversationTask,
      ): TaskDefinition[] => [helpQuestion, summarizeConversation],
      inject: [HelpQuestionTask, SummarizeConversationTask],
    },
    TaskRegistryService,
  ],
  // Re-exported so `AssistantModule` can move its booking flow onto the same
  // Bedrock router, rate limit, token budget and usage log as `/ai/chat`,
  // without duplicating any of this wiring.
  exports: [LlmModule, RateLimitService, UsageLogService],
})
export class AiGatewayModule {}
