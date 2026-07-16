import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AssistantService, type AssistantReply } from './assistant.service.js';
import { ChatRequestDto } from './dto/chat.dto.js';

/**
 * OpenAI booking assistant (SPEC §12B). The model decides; the server executes.
 *
 * Guarded, unlike the rest of the REST surface, because this endpoint is not
 * read-only: `bookLesson` is one of the model's tools, so a turn can create a
 * real booking — and every turn spends money at OpenAI. Signed-in students only,
 * ten turns a minute, booking for the caller rather than a demo account.
 */
@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @ApiOkResponse({ description: 'The assistant reply and the tools it invoked.' })
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatRequestDto): Promise<AssistantReply> {
    return this.assistant.chat(dto.messages, user.studentId);
  }
}
