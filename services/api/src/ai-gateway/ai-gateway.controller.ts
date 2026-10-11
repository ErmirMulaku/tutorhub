import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AiChatRequestDto } from './dto/ai-chat.dto.js';
import { TaskRegistryService, type TaskName, type TaskResult } from './tasks/task-registry.js';
import { validateTaskInput } from './validate-task-input.js';

export interface AiChatResponseBody extends TaskResult {
  task: TaskName;
  cached: boolean;
}

export interface AiTaskSummary {
  name: TaskName;
}

@ApiTags('ai-gateway')
@Controller('ai')
export class AiGatewayController {
  constructor(private readonly registry: TaskRegistryService) {}

  @Get('tasks')
  @ApiOkResponse({ description: 'Tasks registered with the AI gateway.' })
  tasks(): AiTaskSummary[] {
    return this.registry.list().map((task) => ({ name: task.name }));
  }

  @Post('chat')
  @ApiOkResponse({ description: 'The task answer, model used, and token/cost usage.' })
  async chat(@Body() dto: AiChatRequestDto): Promise<AiChatResponseBody> {
    const task = this.registry.get(dto.task);
    if (task === undefined) {
      throw new BadRequestException(`Unknown task: ${dto.task}`);
    }

    const input = await validateTaskInput(task.inputDto, dto.input);
    const result = await task.run({ input });

    return { task: task.name, cached: false, ...result };
  }
}
