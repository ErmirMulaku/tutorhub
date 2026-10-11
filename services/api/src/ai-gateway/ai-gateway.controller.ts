import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal } from './auth/current-principal.decorator.js';
import { PrincipalGuard } from './auth/principal.guard.js';
import type { Principal } from './auth/principal.js';
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
@ApiBearerAuth()
@Controller('ai')
@UseGuards(PrincipalGuard)
export class AiGatewayController {
  constructor(private readonly registry: TaskRegistryService) {}

  @Get('tasks')
  @ApiOkResponse({ description: 'Tasks the caller may use.' })
  tasks(@CurrentPrincipal() principal: Principal): AiTaskSummary[] {
    return this.registry
      .list()
      .filter((task) => task.allowedKinds.includes(principal.kind))
      .map((task) => ({ name: task.name }));
  }

  @Post('chat')
  @ApiOkResponse({ description: 'The task answer, model used, and token/cost usage.' })
  async chat(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: AiChatRequestDto,
  ): Promise<AiChatResponseBody> {
    const task = this.registry.get(dto.task);
    if (task === undefined) {
      throw new BadRequestException(`Unknown task: ${dto.task}`);
    }
    if (!task.allowedKinds.includes(principal.kind)) {
      throw new ForbiddenException(`${principal.kind} may not use task: ${task.name}`);
    }

    const input = await validateTaskInput(task.inputDto, dto.input);
    const result = await task.run({ input, principal });

    return { task: task.name, cached: false, ...result };
  }
}
