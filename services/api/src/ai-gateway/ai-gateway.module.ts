import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AiGatewayController } from './ai-gateway.controller.js';
import { PrincipalGuard } from './auth/principal.guard.js';
import { RateLimitService } from './limits/rate-limit.service.js';
import { RedisService } from './limits/redis.service.js';
import { BedrockLlmClient } from './llm/bedrock-llm.client.js';
import { LLM_CLIENT } from './llm/llm-client.js';
import { ModelRouterService } from './llm/model-router.service.js';
import { HelpQuestionTask } from './tasks/help-question.task.js';
import { SummarizeConversationTask } from './tasks/summarize-conversation.task.js';
import { AI_TASKS, TaskRegistryService, type TaskDefinition } from './tasks/task-registry.js';

@Module({
  imports: [AuthModule],
  controllers: [AiGatewayController],
  providers: [
    PrincipalGuard,
    RedisService,
    RateLimitService,
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
    ModelRouterService,
    { provide: LLM_CLIENT, useClass: BedrockLlmClient },
  ],
})
export class AiGatewayModule {}
