import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AvailabilityModule } from '../availability/availability.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { TutorsModule } from '../tutors/tutors.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { ToolDispatcher } from './assistant.tools.js';

/**
 * The AI booking assistant (SPEC §12B, deprecated — see assistant.controller.ts).
 * Reuses the existing service layer for the tools, so the model's chosen
 * actions run through the same validation as every other request.
 *
 * Imports `AiGatewayModule` to reuse its Bedrock router, rate limit, daily
 * token budget, and usage log rather than duplicating that wiring — this
 * flow now shares the same per-principal budget pool as `/ai/chat`.
 */
@Module({
  imports: [AiGatewayModule, AuthModule, TutorsModule, AvailabilityModule, BookingsModule],
  providers: [AssistantService, ToolDispatcher],
  controllers: [AssistantController],
})
export class AssistantModule {}
