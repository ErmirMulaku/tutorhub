import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import { SenderKind, type Message } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessageEvents } from './message-events.js';

export interface ConversationRow {
  id: string;
  studentName: string;
  studentAvatarColor: string | null;
  subjectName: string | null;
  lastMessageAt: Date;
  preview: string | null;
  unread: number;
}

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: MessageEvents,
  ) {}

  /** Thread list for a tutor, newest first, with preview + unread count. */
  async conversations(tutorId: string): Promise<ConversationRow[]> {
    const convos = await this.prisma.conversation.findMany({
      where: { tutorId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        student: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const rows = await Promise.all(
      convos.map(async (c) => ({
        id: c.id,
        studentName: c.student.fullName,
        studentAvatarColor: c.student.avatarColor,
        subjectName: c.subjectName,
        lastMessageAt: c.lastMessageAt,
        preview: c.messages[0]?.body ?? null,
        unread: await this.prisma.message.count({
          where: { conversationId: c.id, senderKind: SenderKind.STUDENT, readByTutor: false },
        }),
      })),
    );
    return rows;
  }

  /** Confirm a conversation belongs to the tutor (404 otherwise). */
  private async owned(conversationId: string, tutorId: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (convo === null || convo.tutorId !== tutorId) {
      throw new EntityNotFoundError('Conversation', conversationId);
    }
  }

  async messages(conversationId: string, tutorId: string): Promise<Message[]> {
    await this.owned(conversationId, tutorId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(tutorId: string, conversationId: string, body: string): Promise<Message> {
    await this.owned(conversationId, tutorId);
    const message = await this.prisma.message.create({
      data: { conversationId, senderKind: SenderKind.TUTOR, body, readByTutor: true },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    this.events.emit({ message, tutorId });
    return message;
  }

  async markRead(tutorId: string, conversationId: string): Promise<ConversationRow[]> {
    await this.owned(conversationId, tutorId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderKind: SenderKind.STUDENT, readByTutor: false },
      data: { readByTutor: true },
    });
    return this.conversations(tutorId);
  }

  /** Total messages from students the tutor hasn't read (for the KPI/badge). */
  unreadCount(tutorId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        senderKind: SenderKind.STUDENT,
        readByTutor: false,
        conversation: { tutorId },
      },
    });
  }
}
