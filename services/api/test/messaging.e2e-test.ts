import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Socket, io } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { MessagingService } from '../src/messaging/messaging.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PORT = 4102;

interface MessageReceived {
  id: string;
  conversationId: string;
  senderKind: string;
  body: string;
}

describe('MessagingGateway + service (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let messaging: MessagingService;
  let client: Socket;
  const ids = { tutor: '', student: '', conversation: '' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(PORT);
    prisma = app.get(PrismaService);
    messaging = app.get(MessagingService);

    const stamp = Date.now().toString();
    const tutor = await prisma.tutor.create({
      data: { name: 'Msg Tutor', timezone: 'UTC', hourlyCents: 3000, workingHours: [] },
    });
    const student = await prisma.student.create({
      data: { fullName: 'Msg Student', email: `msg+${stamp}@example.com`, avatarColor: 'teal' },
    });
    ids.tutor = tutor.id;
    ids.student = student.id;
    const convo = await prisma.conversation.create({
      data: { tutorId: tutor.id, studentId: student.id, subjectName: 'Maths' },
    });
    ids.conversation = convo.id;
    // A student message that starts unread.
    await prisma.message.create({
      data: {
        conversationId: convo.id,
        senderKind: 'STUDENT',
        body: 'Hello tutor',
        readByTutor: false,
      },
    });

    client = io(`http://localhost:${PORT.toString()}`, { transports: ['websocket'] });
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));
  });

  afterAll(async () => {
    client.close();
    await prisma.message.deleteMany({ where: { conversationId: ids.conversation } });
    await prisma.conversation.deleteMany({ where: { id: ids.conversation } });
    await prisma.student.deleteMany({ where: { id: ids.student } });
    await prisma.tutor.deleteMany({ where: { id: ids.tutor } });
    await app.close();
  });

  it('lists conversations with an unread count', async () => {
    const convos = await messaging.conversations(ids.tutor);
    expect(convos).toHaveLength(1);
    expect(convos[0]?.unread).toBe(1);
  });

  it('markRead clears the unread count', async () => {
    await messaging.markRead(ids.tutor, ids.conversation);
    expect(await messaging.unreadCount(ids.tutor)).toBe(0);
  });

  it('sendMessage pushes a messageReceived event to the conversation room', async () => {
    await new Promise<void>((resolve) => {
      client.emit('subscribeConversation', { conversationId: ids.conversation }, () => resolve());
    });
    const received = new Promise<MessageReceived>((resolve) => {
      client.once('messageReceived', (payload: MessageReceived) => resolve(payload));
    });

    const sent = await messaging.sendMessage(ids.tutor, ids.conversation, 'Reply from tutor');
    const payload = await received;
    expect(payload.id).toBe(sent.id);
    expect(payload.senderKind).toBe('TUTOR');
    expect(payload.body).toBe('Reply from tutor');
  });
});
