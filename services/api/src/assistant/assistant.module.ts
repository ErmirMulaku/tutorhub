import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module.js';
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
 *
 * Throttling is configured here rather than globally: every turn spends money
 * at OpenAI and can loop up to MAX_STEPS model round-trips, so this endpoint —
 * unlike the rest of the API — has a per-caller cost. Scoping it here also
 * keeps the limit off the read-heavy GraphQL surface.
 */
@Module({
  imports: [
    AuthModule,
    TutorsModule,
    AvailabilityModule,
    BookingsModule,
    // 10 turns/minute per caller: generous for a conversation, useless for
    // draining an OpenAI balance.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  providers: [AssistantService, OpenAiService, ToolDispatcher],
  controllers: [AssistantController],
})
export class AssistantModule {}
