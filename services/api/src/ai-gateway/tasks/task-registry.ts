import { Inject, Injectable } from '@nestjs/common';
import type { PrincipalKind } from '../../auth/auth-user.js';
import type { Principal } from '../auth/principal.js';
import type { StreamToken } from '../llm/llm-client.js';

export type TaskName = 'help_question' | 'summarize_conversation';

export interface TaskUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface TaskSource {
  n: number;
  articleId: string;
  title: string;
}

export interface TaskResult {
  answer: string;
  model: string;
  usage: TaskUsage;
  sources?: TaskSource[];
}

export interface TaskContext<TInput extends object = object> {
  input: TInput;
  principal: Principal;
}

export interface TaskDefinition<TInput extends object = object> {
  name: TaskName;
  /** RBAC: which principal kinds may call this task. */
  allowedKinds: PrincipalKind[];
  /** [primary, fallback] model ids, read from config. */
  modelChain: string[];
  promptVersion: number;
  maxOutputTokens: number;
  temperature: number;
  /** null = never cache. */
  cacheTtlSeconds: number | null;
  /** Validates + shapes the raw `input` object the controller receives. */
  inputDto: new () => TInput;
  /**
   * Builds this call's cache key. Required whenever `cacheTtlSeconds` isn't
   * null. Must enforce the same data-scope checks `run()` does — a cache
   * hit skips `run()` entirely, so it's the only authorization check a
   * cached call gets.
   */
  cacheKey?(ctx: TaskContext<TInput>): Promise<string>;
  run(ctx: TaskContext<TInput>): Promise<TaskResult>;
  /**
   * Streaming counterpart to `run()`. Optional — a task without it doesn't
   * support `POST /ai/chat/stream`. `signal` fires if the client disconnects
   * (`res.on('close')`), so the task can stop paying for tokens no one will see.
   */
  runStream?(
    ctx: TaskContext<TInput>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamToken, TaskResult>;
}

/** DI token for the array of registered task definitions (see {@link AiGatewayModule}). */
export const AI_TASKS = 'AI_TASKS';

/** Looks up a {@link TaskDefinition} by name. Unknown names return `undefined`. */
@Injectable()
export class TaskRegistryService {
  private readonly tasks: Map<TaskName, TaskDefinition>;

  constructor(@Inject(AI_TASKS) tasks: TaskDefinition[]) {
    this.tasks = new Map(tasks.map((task) => [task.name, task]));
  }

  get(name: string): TaskDefinition | undefined {
    return this.tasks.get(name as TaskName);
  }

  list(): TaskDefinition[] {
    return [...this.tasks.values()];
  }
}
