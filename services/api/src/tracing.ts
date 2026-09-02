/**
 * OpenTelemetry bootstrap. This module must be evaluated *before* any
 * application code so the auto-instrumentations can patch `http`, `express`,
 * `graphql`, `pg`, ... as those modules are first imported. The package is ESM
 * (`"type": "module"`), so it is wired up with `node --import ./tracing.js`
 * rather than the CommonJS-only `--require`.
 *
 * Prisma note: Prisma 7 no longer takes a `previewFeatures = ["tracing"]` flag
 * — the CLI reports it as deprecated ("the functionality can be used without
 * specifying it as a preview feature"). Instead, `PrismaInstrumentation.enable()`
 * publishes a tracing helper on `globalThis` (`V7_PRISMA_INSTRUMENTATION`) and
 * the client runtime picks it up, wrapping every statement it executes in a
 * `prisma:client:db_query` span carrying `db.query.text`. So registering the
 * instrumentation below is all that's needed; the schema stays untouched.
 */
import { register } from 'node:module';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

// The instrumentations hook `require()` by default, which never fires for an
// ESM `import`. Without this loader, anything the app imports as ESM — most
// importantly `node:http` — loads unpatched and produces no spans at all.
// Must run before the SDK starts, and before the app imports those modules.
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

// The exporter resolves OTEL_EXPORTER_OTLP_TRACES_ENDPOINT / _ENDPOINT itself
// (appending `v1/traces` to the latter), so only fall back to an explicit URL
// when neither is configured. An explicit `url` would otherwise win over both.
const hasEndpointFromEnv =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT !== undefined ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'tutorhub-api',
  traceExporter: new OTLPTraceExporter(
    hasEndpointFromEnv ? {} : { url: 'http://localhost:4318/v1/traces' },
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Traces every file read the process makes — orders of magnitude more
      // spans than the requests they belong to, and none of it actionable.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
    // Emits one span per SQL statement Prisma runs, nested under the resolver
    // that triggered it. `instrumentation-pg` (on by default above) adds the
    // driver-level view of the same statement underneath it.
    new PrismaInstrumentation(),
  ],
});

sdk.start();

// Nothing else listens for these today, so the handlers own the exit: adding a
// listener suppresses Node's default "terminate on signal" behaviour, and
// without the explicit exit the process would hang instead of stopping.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void sdk
      .shutdown()
      .catch((err: unknown) => {
        console.error('OpenTelemetry shutdown failed', err);
      })
      .finally(() => process.exit(0));
  });
}
