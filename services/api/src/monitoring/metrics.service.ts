import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

type HttpLabel = 'method' | 'route' | 'status';

/**
 * Owns the Prometheus registry. Exposes process/runtime default metrics plus
 * per-request HTTP counters and a latency histogram. Scraped at `/metrics`.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly requests: Counter<HttpLabel>;
  private readonly duration: Histogram<HttpLabel>;

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
  }

  /** Record one completed request. */
  observe(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.requests.inc(labels);
    this.duration.observe(labels, durationSeconds);
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
