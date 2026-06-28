import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import type { Message } from '../generated/prisma/client.js';
import { ConversationModel, MessageModel } from '../graphql/models/message.model.js';
import { type ConversationRow, MessagingService } from './messaging.service.js';

@Resolver()
@UseGuards(TutorAuthGuard)
export class MessagingResolver {
  constructor(private readonly messaging: MessagingService) {}

  @Query(() => [ConversationModel], { name: 'conversations' })
  conversations(@CurrentTutor() tutor: TutorPrincipal): Promise<ConversationRow[]> {
    return this.messaging.conversations(tutor.tutorId);
  }

  @Query(() => [MessageModel], { name: 'messages' })
  messages(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<Message[]> {
    return this.messaging.messages(conversationId, tutor.tutorId);
  }

  @Mutation(() => MessageModel, { name: 'sendMessage' })
  sendMessage(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args('body') body: string,
  ): Promise<Message> {
    return this.messaging.sendMessage(tutor.tutorId, conversationId, body);
  }

  @Mutation(() => [ConversationModel], { name: 'markConversationRead' })
  markConversationRead(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<ConversationRow[]> {
    return this.messaging.markRead(tutor.tutorId, conversationId);
  }
}
