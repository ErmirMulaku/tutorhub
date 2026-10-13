import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContentBlock, ConverseMessage } from '../ai-gateway/llm/llm-client.js';
import { modelChainFrom } from '../ai-gateway/tasks/model-chain.js';
import { ModelRouterService } from '../ai-gateway/llm/model-router.service.js';
import { ToolDispatcher, TOOLS } from './assistant.tools.js';

/** Cap on tool-call round-trips per turn, to bound cost and stop loops. */
const MAX_STEPS = 6;
const MAX_OUTPUT_TOKENS = 600;
const TEMPERATURE = 0.2;

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

export interface AssistantUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AssistantReply {
  reply: string;
  /** Tools the model invoked this turn, for transparency and tests. */
  toolsUsed: string[];
  /** In-app destinations to offer as follow-up links (deduped, most-recent). */
  actions: AssistantAction[];
}

/** Internal result — same public shape, plus usage for the gateway's budget/log. */
export interface AssistantOutcome extends AssistantReply {
  model: string;
  usage: AssistantUsage;
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
 * Orchestrates a Bedrock Converse tool-calling turn: the model decides which
 * tools to call, this service executes them server-side via
 * {@link ToolDispatcher}, feeds results back, and loops until the model
 * produces a final reply.
 *
 * @deprecated Kept for the live marketplace while the unified `/ai/chat`
 * tool-calling endpoint is built (see docs/UNIFIED_AI_CHAT_PLAN.md Phase 2).
 * Same request/response contract as before; the model call moved from
 * OpenAI to Bedrock.
 */
@Injectable()
export class AssistantService {
  private readonly modelChain: [string, ...string[]];

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(ModelRouterService) private readonly router: ModelRouterService,
    @Inject(ToolDispatcher) private readonly dispatcher: ToolDispatcher,
  ) {
    this.modelChain = modelChainFrom(config);
  }

  /**
   * One assistant turn on behalf of `studentId`.
   *
   * The caller's id is passed in rather than looked up: the assistant can book
   * lessons, so it must act as whoever is signed in. It previously resolved a
   * fixed DEMO_STUDENT_EMAIL, which meant every booking it made — from anyone —
   * landed on the same demo account.
   */
  async chat(history: ChatTurn[], studentId: string): Promise<AssistantOutcome> {
    const today = new Date().toISOString().slice(0, 10);
    const messages: ConverseMessage[] = history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
    const toolsUsed: string[] = [];
    const actions: AssistantAction[] = [];
    // Tutor names seen via searchTutors, so a later profile link can be labelled.
    const tutorNames = new Map<string, string>();
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let model = this.modelChain[0];

    for (let step = 0; step < MAX_STEPS; step++) {
      const stream = this.router.runStream(this.modelChain, {
        system: systemPrompt(today),
        messages,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        tools: TOOLS,
      });

      let text = '';
      const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
      let next = await stream.next();
      while (!next.done) {
        if (next.value.kind === 'text') {
          text += next.value.text;
        } else {
          toolUses.push(next.value);
        }
        next = await stream.next();
      }
      const routed = next.value;
      model = routed.modelId;
      inputTokens += routed.inputTokens;
      outputTokens += routed.outputTokens;
      costUsd += routed.costUsd;

      if (toolUses.length === 0) {
        return {
          reply: text,
          toolsUsed,
          actions: dedupeActions(actions),
          model,
          usage: { inputTokens, outputTokens, costUsd },
        };
      }

      const assistantBlocks: ContentBlock[] = [];
      if (text !== '') {
        assistantBlocks.push({ type: 'text', text });
      }
      for (const toolUse of toolUses) {
        assistantBlocks.push({ type: 'toolUse', ...toolUse });
      }
      messages.push({ role: 'assistant', content: assistantBlocks });

      const resultBlocks: ContentBlock[] = [];
      for (const toolUse of toolUses) {
        toolsUsed.push(toolUse.name);
        const result = await this.dispatcher.execute(
          toolUse.name,
          JSON.stringify(toolUse.input),
          studentId,
        );
        const isError = typeof result === 'object' && result !== null && 'error' in result;
        resultBlocks.push({
          type: 'toolResult',
          toolUseId: toolUse.id,
          content: JSON.stringify(result),
          isError,
        });
        this.recordActions(toolUse.name, toolUse.input, result, actions, tutorNames);
      }
      messages.push({ role: 'user', content: resultBlocks });
    }

    return {
      reply: "Sorry — I couldn't complete that. Please try rephrasing.",
      toolsUsed,
      actions: dedupeActions(actions),
      model,
      usage: { inputTokens, outputTokens, costUsd },
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
    args: Record<string, unknown>,
    result: unknown,
    actions: AssistantAction[],
    tutorNames: Map<string, string>,
  ): void {
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
