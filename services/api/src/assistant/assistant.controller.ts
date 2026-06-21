import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AssistantService, type AssistantReply } from './assistant.service.js';
import { ChatRequestDto } from './dto/chat.dto.js';

/** OpenAI booking assistant (SPEC §12B). The model decides; the server executes. */
@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @ApiOkResponse({ description: 'The assistant reply and the tools it invoked.' })
  chat(@Body() dto: ChatRequestDto): Promise<AssistantReply> {
    return this.assistant.chat(dto.messages);
  }
}
