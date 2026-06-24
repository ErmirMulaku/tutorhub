import { cookies } from 'next/headers';
import { getDemoStudentToken } from './auth';

/**
 * Session token handling. Real signup/signin store a student JWT in an
 * httpOnly cookie. When no session exists we fall back to the seeded demo
 * student so the storefront is usable out of the box (the design ships logged
 * in as "Alex Morgan").
 */
const COOKIE = 'th_token';
const ONE_DAY = 60 * 60 * 24;

/** The signed-in student's JWT, or `null` when there is no real session. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** A token for authenticated reads — the real session or the demo fallback. */
export async function getTokenOrDemo(): Promise<string> {
  return (await getSessionToken()) ?? (await getDemoStudentToken());
}

/** True when a real (non-demo) session cookie is present. */
export async function isAuthenticated(): Promise<boolean> {
  return (await getSessionToken()) !== null;
}

export async function setSessionToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_DAY,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
