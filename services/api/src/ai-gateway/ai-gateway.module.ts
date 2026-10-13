import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvailabilityModule } from '../availability/availability.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { TutorsModule } from '../tutors/tutors.module.js';
import { ToolDispatcher } from '../assistant/assistant.tools.js';
import { MonitoringModule } from '../monitoring/monitoring.module.js';
import { AiGatewayController } from './ai-gateway.controller.js';
import { PrincipalGuard } from './auth/principal.guard.js';
import { AiCacheService } from './cache/ai-cache.service.js';
import { ConfirmationService } from './confirmation/confirmation.service.js';
import { RateLimitService } from './limits/rate-limit.service.js';
import { RedisService } from './limits/redis.service.js';
import { LlmModule } from './llm/llm.module.js';
import { RagModule } from './rag/rag.module.js';
import { ChatTask } from './tasks/chat.task.js';
import { HelpQuestionTask } from './tasks/help-question.task.js';
import { SummarizeConversationTask } from './tasks/summarize-conversation.task.js';
import { AI_TASKS, TaskRegistryService, type TaskDefinition } from './tasks/task-registry.js';
import { BookingToolsProvider } from './tools/booking.tools.js';
import { HelpArticlesTool } from './tools/help-articles.tool.js';
import { AI_TOOLS, ToolRegistryService, type ToolDefinition } from './tools/tool-registry.js';
import { UsageLogService } from './usage/usage-log.service.js';

@Module({
  imports: [
    AuthModule,
    RagModule,
    MonitoringModule,
    LlmModule,
    TutorsModule,
    AvailabilityModule,
    BookingsModule,
  ],
  controllers: [AiGatewayController],
  providers: [
    PrincipalGuard,
    RedisService,
    RateLimitService,
    AiCacheService,
    UsageLogService,
    ConfirmationService,
    ToolDispatcher,
    HelpArticlesTool,
    BookingToolsProvider,
    {
      provide: AI_TOOLS,
      useFactory: (
        helpArticles: HelpArticlesTool,
        booking: BookingToolsProvider,
      ): ToolDefinition[] => [helpArticles, ...booking.tools],
      inject: [HelpArticlesTool, BookingToolsProvider],
    },
    ToolRegistryService,
    HelpQuestionTask,
    SummarizeConversationTask,
    ChatTask,
    {
      provide: AI_TASKS,
      useFactory: (
        helpQuestion: HelpQuestionTask,
        summarizeConversation: SummarizeConversationTask,
        chat: ChatTask,
      ): TaskDefinition[] => [helpQuestion, summarizeConversation, chat],
      inject: [HelpQuestionTask, SummarizeConversationTask, ChatTask],
    },
    TaskRegistryService,
  ],
  // Re-exported so `AssistantModule` can move its booking flow onto the same
  // Bedrock router, rate limit, token budget and usage log as `/ai/chat`,
  // without duplicating any of this wiring.
  exports: [LlmModule, RateLimitService, UsageLogService],
})
export class AiGatewayModule {}
