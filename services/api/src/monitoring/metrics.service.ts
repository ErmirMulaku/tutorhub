import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

type HttpLabel = 'method' | 'route' | 'status';
type AiRequestLabel = 'task' | 'model' | 'status' | 'cache';
type AiTokenLabel = 'task' | 'model' | 'direction';
type AiCostLabel = 'task' | 'model';
type AiDurationLabel = 'task';

export interface AiRequestObservation {
  task: string;
  model: string;
  status: string;
  cacheHit: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationSeconds: number;
}

/**
 * Owns the Prometheus registry. Exposes process/runtime default metrics plus
 * per-request HTTP counters, a latency histogram, and the AI gateway's own
 * request/token/cost/latency metrics. Scraped at `/metrics`.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly requests: Counter<HttpLabel>;
  private readonly duration: Histogram<HttpLabel>;
  private readonly aiRequests: Counter<AiRequestLabel>;
  private readonly aiTokens: Counter<AiTokenLabel>;
  private readonly aiCost: Counter<AiCostLabel>;
  private readonly aiDuration: Histogram<AiDurationLabel>;
  private readonly idempotentReplays: Counter;

  constructor() {
    this.registry.setDefaultLabels({ app: 'tutorhub-api' });
    collectDefaultMetrics({ register: this.registry });

    this.requests = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests, by method, normalized route, and status.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.duration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.aiRequests = new Counter({
      name: 'ai_requests_total',
      help: 'Total AI gateway requests, by task, model, status, and cache hit.',
      labelNames: ['task', 'model', 'status', 'cache'],
      registers: [this.registry],
    });
    this.aiTokens = new Counter({
      name: 'ai_tokens_total',
      help: 'Total tokens spent, by task, model, and direction (in/out).',
      labelNames: ['task', 'model', 'direction'],
      registers: [this.registry],
    });
    this.aiCost = new Counter({
      name: 'ai_cost_usd_total',
      help: 'Total estimated cost in USD, by task and model.',
      labelNames: ['task', 'model'],
      registers: [this.registry],
    });
    this.aiDuration = new Histogram({
      name: 'ai_request_duration_seconds',
      help: 'AI gateway request latency in seconds, by task.',
      labelNames: ['task'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30],
      registers: [this.registry],
    });

    this.idempotentReplays = new Counter({
      name: 'idempotent_replays_total',
      help: 'Requests answered from a stored response because their Idempotency-Key was seen before.',
      registers: [this.registry],
    });
  }

  /** Record one completed request. */
  observe(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.requests.inc(labels);
    this.duration.observe(labels, durationSeconds);
  }

  /** Record one completed /ai/chat call, whatever its outcome. */
  observeAiRequest(obs: AiRequestObservation): void {
    const cache = obs.cacheHit ? 'hit' : 'miss';
    this.aiRequests.inc({ task: obs.task, model: obs.model, status: obs.status, cache });
    this.aiTokens.inc({ task: obs.task, model: obs.model, direction: 'in' }, obs.inputTokens);
    this.aiTokens.inc({ task: obs.task, model: obs.model, direction: 'out' }, obs.outputTokens);
    this.aiCost.inc({ task: obs.task, model: obs.model }, obs.costUsd);
    this.aiDuration.observe({ task: obs.task }, obs.durationSeconds);
  }

  /** A retried request got the stored response instead of doing the work again. */
  countIdempotentReplay(): void {
    this.idempotentReplays.inc();
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
