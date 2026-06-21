import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PrismaService } from '../prisma/prisma.service.js';
import { OpenAiService } from './openai.service.js';
import { ToolDispatcher, TOOLS } from './assistant.tools.js';

/** Cap on tool-call round-trips per turn, to bound cost and stop loops. */
const MAX_STEPS = 6;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantReply {
  reply: string;
  /** Tools the model invoked this turn, for transparency and tests. */
  toolsUsed: string[];
}

function systemPrompt(today: string): string {
  return [
    "You are TutorHub's booking assistant. Help the student find a tutor and book a lesson.",
    'Use the tools to search tutors, check availability, and book — never invent ids, prices, or slots.',
    'Always confirm the subject, day, and time before booking. Keep replies short and friendly.',
    `Today is ${today} (UTC). Resolve relative dates ("tomorrow", "Monday") to YYYY-MM-DD.`,
  ].join(' ');
}

/**
 * Orchestrates an OpenAI function-calling turn: the model decides which tools to
 * call, this service executes them server-side via {@link ToolDispatcher}, feeds
 * results back, and loops until the model produces a final reply.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly openai: OpenAiService,
    private readonly dispatcher: ToolDispatcher,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async chat(history: ChatTurn[]): Promise<AssistantReply> {
    if (!this.openai.isConfigured()) {
      throw new ServiceUnavailableException('The booking assistant is not configured.');
    }
    const studentId = await this.resolveStudentId();
    const today = new Date().toISOString().slice(0, 10);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt(today) },
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
    ];
    const toolsUsed: string[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const message = await this.openai.chat(messages, TOOLS);
      const toolCalls = message.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return { reply: message.content ?? '', toolsUsed };
      }

      messages.push({ role: 'assistant', content: message.content, tool_calls: toolCalls });

      for (const call of toolCalls) {
        if (call.type !== 'function') continue;
        toolsUsed.push(call.function.name);
        const result = await this.dispatcher.execute(
          call.function.name,
          call.function.arguments,
          studentId,
        );
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return { reply: "Sorry — I couldn't complete that. Please try rephrasing.", toolsUsed };
  }

  /** Resolve the demo student the assistant books as (no end-user auth yet). */
  private async resolveStudentId(): Promise<string> {
    const email = this.config.get<string>('DEMO_STUDENT_EMAIL') ?? 'sara@example.com';
    const student = await this.prisma.student.findFirst({ where: { email } });
    if (!student) {
      throw new ServiceUnavailableException(`Demo student ${email} not found; seed the database.`);
    }
    return student.id;
  }
}
