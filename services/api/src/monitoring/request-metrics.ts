import type { IncomingMessage, ServerResponse } from 'node:http';
import { Logger } from '@nestjs/common';
import type { MetricsService } from './metrics.service.js';

const logger = new Logger('http');

/** Collapse high-cardinality path segments (ids) so label sets stay bounded. */
export function normalizeRoute(url: string): string {
  const path = url.split('?')[0] ?? '/';
  const normalized = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
  return normalized === '' ? '/' : normalized;
}

/**
 * Express-style global middleware: on response finish it records request
 * metrics and emits a structured (JSON) access log. The `/metrics` scrape
 * endpoint is skipped so Prometheus polling doesn't inflate its own counters.
 */
export function createRequestMetrics(
  metrics: MetricsService,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const route = normalizeRoute(req.url ?? '/');
    if (route === '/metrics') {
      next();
      return;
    }

    const method = req.method ?? 'GET';
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const status = res.statusCode;
      metrics.observe(method, route, status, durationMs / 1000);
      logger.log(JSON.stringify({ method, route, status, durationMs: Math.round(durationMs) }));
    });

    next();
  };
}
