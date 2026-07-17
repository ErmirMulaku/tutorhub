import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OpenAiService } from './openai.service.js';
import { ToolDispatcher, TOOLS } from './assistant.tools.js';

/** Cap on tool-call round-trips per turn, to bound cost and stop loops. */
const MAX_STEPS = 6;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * A place the reply suggests the student navigate to, derived from the tools the
 * model actually ran (not parsed from prose, so the target is always real). The
 * API stays frontend-agnostic: it names *what* to open, and the client maps that
 * to a localized URL and label.
 */
export type AssistantAction =
  | { kind: 'search'; subject?: string; level?: string }
  | { kind: 'tutor'; tutorId: string; tutorName?: string }
  | { kind: 'lessons' };

export interface AssistantReply {
  reply: string;
  /** Tools the model invoked this turn, for transparency and tests. */
  toolsUsed: string[];
  /** In-app destinations to offer as follow-up links (deduped, most-recent). */
  actions: AssistantAction[];
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function argString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Collapse repeats: keep the last search, one link per tutor, and cap the row. */
function dedupeActions(all: AssistantAction[]): AssistantAction[] {
  const byKey = new Map<string, AssistantAction>();
  for (const action of all) {
    byKey.set(action.kind === 'tutor' ? `tutor:${action.tutorId}` : action.kind, action);
  }
  return Array.from(byKey.values()).slice(-3);
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
  ) {}

  /**
   * One assistant turn on behalf of `studentId`.
   *
   * The caller's id is passed in rather than looked up: the assistant can book
   * lessons, so it must act as whoever is signed in. It previously resolved a
   * fixed DEMO_STUDENT_EMAIL, which meant every booking it made — from anyone —
   * landed on the same demo account.
   */
  async chat(history: ChatTurn[], studentId: string): Promise<AssistantReply> {
    if (!this.openai.isConfigured()) {
      throw new ServiceUnavailableException('The booking assistant is not configured.');
    }
    const today = new Date().toISOString().slice(0, 10);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt(today) },
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
    ];
    const toolsUsed: string[] = [];
    const actions: AssistantAction[] = [];
    // Tutor names seen via searchTutors, so a later profile link can be labelled.
    const tutorNames = new Map<string, string>();

    for (let step = 0; step < MAX_STEPS; step++) {
      const message = await this.openai.chat(messages, TOOLS);
      const toolCalls = message.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return { reply: message.content ?? '', toolsUsed, actions: dedupeActions(actions) };
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
        this.recordActions(
          call.function.name,
          call.function.arguments,
          result,
          actions,
          tutorNames,
        );
      }
    }

    return {
      reply: "Sorry — I couldn't complete that. Please try rephrasing.",
      toolsUsed,
      actions: dedupeActions(actions),
    };
  }

  /**
   * Turn a completed tool call into a follow-up navigation action. Built from the
   * call's own arguments and result — a successful search offers to open the tutor
   * list, working with a specific tutor offers their profile, and a booking offers
   * the lessons page. Failed calls (`{ error }`) contribute nothing.
   */
  private recordActions(
    name: string,
    rawArgs: string,
    result: unknown,
    actions: AssistantAction[],
    tutorNames: Map<string, string>,
  ): void {
    const args = parseArgs(rawArgs);
    const res =
      typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : {};
    const failed = typeof res['error'] === 'string';

    if (name === 'searchTutors') {
      const found = Array.isArray(res['tutors']) ? res['tutors'] : [];
      for (const tutor of found) {
        if (typeof tutor !== 'object' || tutor === null) continue;
        const row = tutor as Record<string, unknown>;
        if (typeof row['id'] === 'string' && typeof row['name'] === 'string') {
          tutorNames.set(row['id'], row['name']);
        }
      }
      const total = typeof res['total'] === 'number' ? res['total'] : 0;
      if (total > 0) {
        actions.push({
          kind: 'search',
          subject: argString(args, 'subject'),
          level: argString(args, 'level'),
        });
      }
      return;
    }

    const tutorId = argString(args, 'tutorId');
    if ((name === 'getAvailability' || name === 'bookLesson') && !failed && tutorId) {
      actions.push({ kind: 'tutor', tutorId, tutorName: tutorNames.get(tutorId) });
    }
    if (name === 'bookLesson' && !failed) {
      actions.push({ kind: 'lessons' });
    }
  }
}
