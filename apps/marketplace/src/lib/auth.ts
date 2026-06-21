import { API_URL } from './env';

/**
 * The storefront has no real student auth yet, so bookings are made as a single
 * seeded demo student. The dev-login exchange happens server-side and the token
 * never reaches the browser.
 */
const DEMO_STUDENT_EMAIL = process.env.DEMO_STUDENT_EMAIL ?? 'sara@example.com';

export async function getDemoStudentToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_STUDENT_EMAIL }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`dev-login failed: ${res.status}`);
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}
