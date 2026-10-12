import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter.js';
import type {
  ConverseRequest,
  StreamResult,
  StreamToken,
} from '../src/ai-gateway/llm/llm-client.js';
import { LLM_CLIENT } from '../src/ai-gateway/llm/llm-client.js';
import { StubLlmClient } from '../src/ai-gateway/llm/stub-llm.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

type ScriptedTurn =
  | { text: string }
  | { toolUse: { id: string; name: string; input: Record<string, unknown> } };

/**
 * Scripted stand-in for Bedrock: extends the real `StubLlmClient` (no network)
 * but replays a queue of canned turns instead of its generic placeholder text,
 * so a test can drive the tool loop deterministically.
 */
class ScriptedLlmClient extends StubLlmClient {
  script: ScriptedTurn[][] = [];

  override async *converseStream(_req: ConverseRequest): AsyncGenerator<StreamToken, StreamResult> {
    await Promise.resolve();
    const turn = this.script.shift();
    if (turn === undefined) {
      throw new Error('ScriptedLlmClient ran out of responses');
    }
    for (const part of turn) {
      if ('text' in part) {
        yield { kind: 'text', text: part.text };
      } else {
        yield { kind: 'tool_use', ...part.toolUse };
      }
    }
    const stopReason = turn.some((part) => 'toolUse' in part) ? 'tool_use' : 'end_turn';
    return { inputTokens: 10, outputTokens: 10, stopReason };
  }
}

describe('Assistant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const llm = new ScriptedLlmClient();

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
      .overrideProvider(LLM_CLIENT)
      .useValue(llm)
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
    // Turn 1: the model asks for bookLesson. Turn 2: it replies in prose.
    llm.script = [
      [
        {
          toolUse: {
            id: 'call_book',
            name: 'bookLesson',
            input: { tutorId, subjectId, startTime },
          },
        },
      ],
      [{ text: 'Done — your lesson is booked!' }],
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
    llm.script = [
      [
        {
          toolUse: {
            id: 'call_search',
            name: 'searchTutors',
            input: { subject: 'Assistant Math' },
          },
        },
      ],
      [{ text: 'Here are some maths tutors.' }],
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

  it('returns 503 when Bedrock is unavailable', async () => {
    llm.script = []; // every call throws "ran out of responses" — not retryable, but
    // withRetry/runWithFallback still exhaust the chain and the router maps that to 503.
    await http()
      .post('/assistant/chat')
      .set('authorization', `Bearer ${authToken}`)
      .send({ messages: [{ role: 'user', content: 'hi' }] })
      .expect(503);
  });
});
