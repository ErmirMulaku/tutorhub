# Operations

How TutorHub is observed today, and how I'd own its uptime in production.

## Endpoints

| Endpoint       | Purpose                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `GET /health`  | **Liveness** — process is up. Cheap, no dependencies. Probe target.     |
| `GET /ready`   | **Readiness** — runs `SELECT 1`; `503` if the database is unreachable.  |
| `GET /metrics` | **Prometheus** exposition: default process metrics + HTTP rate/latency. |
| `GET /status`  | A small self-contained page polling `/health` and `/ready` every 5s.    |

### Metrics

`prom-client` exposes Node/process defaults (CPU, heap, event-loop lag) plus two app metrics, fed by
a global request middleware that also emits a structured JSON access log per request:

- `http_requests_total{method,route,status}` — counter.
- `http_request_duration_seconds{method,route,status}` — histogram.

Routes are normalized (`/tutors/:id`, not raw ids) to keep label cardinality bounded; `/metrics`
itself is excluded so scrapes don't inflate the counters.

## Owning uptime in production

This repo wires the signals; here's how I'd operate them.

- **Probes.** Point the orchestrator's liveness probe at `/health` and the readiness probe at
  `/ready`, so a pod with a dead DB connection is pulled from rotation instead of serving errors.
- **Scraping & dashboards.** Prometheus scrapes `/metrics`; a Grafana board tracks request rate,
  error ratio (`status=~"5.."`), and p50/p95/p99 latency from the histogram, plus event-loop lag and
  heap as saturation signals.
- **SLOs & alerts.** Target **99.9%** availability and **p95 < 300ms** on read paths. Alert on a
  fast+slow burn of the error-rate SLO (multi-window) and on readiness failing across replicas —
  alerting on symptoms (user-facing errors/latency), not just host metrics.
- **Logs & tracing.** Access logs are structured JSON for ingestion; the next step is request-id
  propagation and OpenTelemetry traces across REST/GraphQL/gRPC and the booking path.
- **Runbook.** `/ready` red → check DB connectivity/credentials and connection-pool saturation;
  latency alert → inspect the slowest routes on the dashboard and recent deploys; roll back on
  regression. The mocked-in-CI, live-when-keyed AI assistant degrades to `503` if `OPENAI_API_KEY`
  is missing, so an LLM outage never takes down core booking.
