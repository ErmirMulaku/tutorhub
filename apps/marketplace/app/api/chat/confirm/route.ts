import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';
import { getSessionToken } from '@/lib/session';

/**
 * Proxies a write-action confirmation to `POST /ai/chat/confirm`. Plain JSON,
 * not SSE — same reason as `app/api/chat/route.ts`: the session JWT is
 * attached here, server-side, and never reaches the browser.
 */
export async function POST(req: Request): Promise<Response> {
  const token = await getSessionToken();
  if (token === null) {
    return NextResponse.json({ reason: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const body = (await req.json()) as { token?: unknown };
  if (typeof body.token !== 'string' || body.token === '') {
    return NextResponse.json({ reason: 'FAILED' }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/ai/chat/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: body.token }),
    signal: req.signal,
  });

  const payload: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(payload, { status: upstream.status });
}
