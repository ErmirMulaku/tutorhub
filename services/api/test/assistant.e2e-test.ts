import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ChatCompletionMessage } from 'openai/resources/chat/completions';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import { OpenAiService } from '../src/assistant/openai.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Scripted stand-in for OpenAI: returns canned messages in order, no network. */
class ScriptedOpenAi {
  script: ChatCompletionMessage[] = [];
  configured = true;
  isConfigured(): boolean {
    return this.configured;
  }
  chat(): Promise<ChatCompletionMessage> {
    const next = this.script.shift();
    if (!next) throw new Error('ScriptedOpenAi ran out of responses');
    return Promise.resolve(next);
  }
}

describe('Assistant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const openai = new ScriptedOpenAi();

  let tutorId = '';
  let subjectId = '';
  let studentId = '';
  let bookingId = '';
  let authToken = '';
  const startTime = '2026-07-06T09:00:00.000Z'; // a future Monday

  beforeAll(async () => {
    // The assistant books as the authenticated caller, so we create a student,
    // then sign in as them (below) to drive the guarded endpoint.
    const email = `assistant+${Date.now().toString()}@example.com`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenAiService)
      .useValue(openai)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const student = await prisma.student.create({ data: { fullName: 'Assistant Demo', email } });
    studentId = student.id;
    const tutor = await prisma.tutor.create({
      data: {
        name: 'Assistant Tutor',
        timezone: 'UTC',
        hourlyCents: 4000,
        workingHours: [{ day: 1, start: '09:00', end: '17:00' }],
        subjects: { create: [{ name: 'Assistant Math', level: 'BEGINNER' }] },
      },
      include: { subjects: true },
    });
    tutorId = tutor.id;
    subjectId = tutor.subjects[0]?.id ?? '';

    // The endpoint is guarded now (it books on the caller's account), so acquire
    // a real student JWT the same way the app does.
    const login = await request(app.getHttpServer() as Server)
      .post('/auth/dev-login')
      .send({ email })
      .expect(200);
    authToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    if (bookingId !== '') await prisma.booking.deleteMany({ where: { id: bookingId } });
    if (subjectId !== '') await prisma.subject.deleteMany({ where: { id: subjectId } });
    if (tutorId !== '') await prisma.tutor.deleteMany({ where: { id: tutorId } });
    if (studentId !== '') await prisma.student.deleteMany({ where: { id: studentId } });
    await app.close();
  });

  const http = (): request.Agent => request(app.getHttpServer() as Server);

  it('books a lesson by executing the model-chosen tool server-side', async () => {
    // Turn 1: the model decides to call bookLesson. Turn 2: it replies in prose.
    openai.script = [
      {
        role: 'assistant',
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: 'call_book',
            type: 'function',
            function: {
              name: 'bookLesson',
              arguments: JSON.stringify({ tutorId, subjectId, startTime }),
            },
          },
        ],
      },
      {
        role: 'assistant',
        content: 'Done — your lesson is booked!',
        refusal: null,
      },
    ];

    const res = await http()
      .post('/assistant/chat')
      .set('authorization', `Bearer ${authToken}`)
      .send({ messages: [{ role: 'user', content: 'Book me a beginner maths lesson on July 6.' }] })
      .expect(201);

    const body = res.body as { reply: string; toolsUsed: string[]; actions: unknown[] };
    expect(body.reply).toContain('booked');
    expect(body.toolsUsed).toContain('bookLesson');
    // A successful booking offers follow-up links to the tutor and the lessons page.
    expect(body.actions).toContainEqual({ kind: 'lessons' });
    expect(body.actions).toContainEqual({ kind: 'tutor', tutorId });

    // The tool actually wrote a booking through the real service layer.
    const booking = await prisma.booking.findFirst({ where: { tutorId, studentId } });
    expect(booking).not.toBeNull();
    expect(booking?.status).toBe('PENDING');
    bookingId = booking?.id ?? '';
  });

  it('offers a search link derived from the tutors it found', async () => {
    // Turn 1: the model searches. Turn 2: it replies in prose.
    openai.script = [
      {
        role: 'assistant',
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: 'call_search',
            type: 'function',
            function: {
              name: 'searchTutors',
              arguments: JSON.stringify({ subject: 'Assistant Math' }),
            },
          },
        ],
      },
      { role: 'assistant', content: 'Here are some maths tutors.', refusal: null },
    ];

    const res = await http()
      .post('/assistant/chat')
      .set('authorization', `Bearer ${authToken}`)
      .send({ messages: [{ role: 'user', content: 'Find me a maths tutor.' }] })
      .expect(201);

    const body = res.body as { actions: unknown[] };
    // The link carries the searched subject, so the tutors page opens pre-filtered.
    expect(body.actions).toContainEqual({ kind: 'search', subject: 'Assistant Math' });
  });

  it('returns 503 when the assistant is not configured', async () => {
    openai.script = [];
    openai.configured = false;
    try {
      await http()
        .post('/assistant/chat')
        .set('authorization', `Bearer ${authToken}`)
        .send({ messages: [{ role: 'user', content: 'hi' }] })
        .expect(503);
    } finally {
      openai.configured = true;
    }
  });
});
