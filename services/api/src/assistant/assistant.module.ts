import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { TutorsModule } from '../tutors/tutors.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { ToolDispatcher } from './assistant.tools.js';
import { OpenAiService } from './openai.service.js';

/**
 * The AI booking assistant (SPEC §12B). Reuses the existing service layer for
 * the tools, so the model's chosen actions run through the same validation as
 * every other request.
 */
@Module({
  imports: [TutorsModule, AvailabilityModule, BookingsModule],
  providers: [AssistantService, OpenAiService, ToolDispatcher],
  controllers: [AssistantController],
})
export class AssistantModule {}
