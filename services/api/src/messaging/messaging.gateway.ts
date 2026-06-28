import { type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { MessageEvents } from './message-events.js';

const tutorRoom = (tutorId: string): string => `msg:tutor:${tutorId}`;
const convoRoom = (conversationId: string): string => `msg:convo:${conversationId}`;

/**
 * Pushes new messages live to the dashboard. Clients join their tutor room
 * (`subscribeMessages`); every message from {@link MessageEvents} is fanned out
 * to the tutor room (badge/thread-list refresh) and the conversation room.
 */
@WebSocketGateway({ cors: { origin: true } })
export class MessagingGateway implements OnModuleInit {
  @WebSocketServer() private readonly server!: Server;

  constructor(private readonly events: MessageEvents) {}

  onModuleInit(): void {
    this.events.all().subscribe(({ message, tutorId }) => {
      const payload = {
        id: message.id,
        conversationId: message.conversationId,
        senderKind: message.senderKind,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      };
      this.server.to(tutorRoom(tutorId)).emit('messageReceived', payload);
      this.server.to(convoRoom(message.conversationId)).emit('messageReceived', payload);
    });
  }

  @SubscribeMessage('subscribeMessages')
  subscribeMessages(
    @MessageBody() data: { tutorId: string },
    @ConnectedSocket() client: Socket,
  ): { subscribed: string } {
    void client.join(tutorRoom(data.tutorId));
    return { subscribed: data.tutorId };
  }

  @SubscribeMessage('subscribeConversation')
  subscribeConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ): { subscribed: string } {
    void client.join(convoRoom(data.conversationId));
    return { subscribed: data.conversationId };
  }
}
