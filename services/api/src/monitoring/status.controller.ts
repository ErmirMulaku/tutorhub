import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TutorHub API · Status</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0;
      background: #0f1620; color: #eef3f7; }
    main { max-width: 40rem; margin: 0 auto; padding: 3rem 1.5rem; }
    h1 { color: #2bb6b0; }
    .card { display: flex; align-items: center; justify-content: space-between;
      background: #16202b; border: 1px solid #2a3947; border-radius: 12px;
      padding: 1rem 1.25rem; margin-block: 0.75rem; }
    .dot { inline-size: 0.75rem; block-size: 0.75rem; border-radius: 50%; display: inline-block;
      margin-inline-end: 0.5rem; background: #5b6b7b; }
    .up { background: #2bb6b0; } .down { background: #d64545; }
    .state { font-weight: 700; }
    .links a { color: #2bb6b0; margin-inline-end: 1rem; }
    .muted { color: #9fb0bf; font-size: 0.875rem; }
  </style>
</head>
<body>
  <main>
    <h1>TutorHub API</h1>
    <p class="muted">Live service status. Auto-refreshes every 5s.</p>
    <div class="card"><span><span id="live-dot" class="dot"></span>Liveness <code>/health</code></span>
      <span class="state" id="live">…</span></div>
    <div class="card"><span><span id="ready-dot" class="dot"></span>Readiness <code>/ready</code> (database)</span>
      <span class="state" id="ready">…</span></div>
    <p class="links">
      <a href="/metrics">Metrics</a><a href="/docs">API docs</a><a href="/graphql">GraphQL</a>
    </p>
  </main>
  <script>
    async function probe(path, id) {
      const dot = document.getElementById(id + '-dot');
      const label = document.getElementById(id);
      try {
        const res = await fetch(path, { cache: 'no-store' });
        const ok = res.ok;
        dot.className = 'dot ' + (ok ? 'up' : 'down');
        label.textContent = ok ? 'Operational' : 'Down';
      } catch {
        dot.className = 'dot down';
        label.textContent = 'Unreachable';
      }
    }
    function refresh() { probe('/health', 'live'); probe('/ready', 'ready'); }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;

/** A tiny self-contained status page (SPEC §13) that polls liveness/readiness. */
@Controller()
export class StatusController {
  @Get('status')
  @Header('content-type', 'text/html; charset=utf-8')
  @ApiExcludeEndpoint()
  status(): string {
    return PAGE;
  }
}
