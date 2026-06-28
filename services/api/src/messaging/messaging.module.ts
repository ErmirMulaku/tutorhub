import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MessageEvents } from './message-events.js';
import { MessagingGateway } from './messaging.gateway.js';
import { MessagingResolver } from './messaging.resolver.js';
import { MessagingService } from './messaging.service.js';

@Module({
  imports: [AuthModule],
  providers: [MessagingService, MessagingResolver, MessageEvents, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
