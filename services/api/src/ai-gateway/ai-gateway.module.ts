import { Module } from '@nestjs/common';
import { AiGatewayController } from './ai-gateway.controller.js';
import { LLM_CLIENT } from './llm/llm-client.js';
import { StubLlmClient } from './llm/stub-llm.client.js';
import { HelpQuestionTask } from './tasks/help-question.task.js';
import { SummarizeConversationTask } from './tasks/summarize-conversation.task.js';
import { AI_TASKS, TaskRegistryService, type TaskDefinition } from './tasks/task-registry.js';

@Module({
  controllers: [AiGatewayController],
  providers: [
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
    // Swapped for BedrockLlmClient in Block 4.
    { provide: LLM_CLIENT, useClass: StubLlmClient },
  ],
})
export class AiGatewayModule {}
