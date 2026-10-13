import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';
import { getSessionToken } from '@/lib/session';

/**
 * Proxies the unified chat to the AI gateway's `POST /ai/chat/stream` (SSE),
 * so the browser can read it progressively via `fetch` + a `ReadableStream`
 * — the same-origin route handler is what makes that possible without ever
 * handing the session JWT to client-side JS (attached here, server-side,
 * same as the server actions).
 */
export async function POST(req: Request): Promise<Response> {
  const token = await getSessionToken();
  if (token === null) {
    return NextResponse.json({ reason: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const body = (await req.json()) as { messages?: unknown };
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ reason: 'FAILED' }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/ai/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ task: 'chat', input: { messages: body.messages } }),
    signal: req.signal,
  });

  // Pre-stream failures (401/429/503/400) come back as plain JSON, not SSE —
  // the gateway only switches to text/event-stream once it starts tokens.
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const reason =
      upstream.status === 429
        ? upstream.headers.has('retry-after')
          ? 'RATE_LIMITED'
          : 'BUDGET_EXCEEDED'
        : upstream.status === 503
          ? 'UNAVAILABLE'
          : 'FAILED';
    const retryAfterSec = Number(upstream.headers.get('retry-after') ?? '0');
    return NextResponse.json({ reason, retryAfterSec }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
