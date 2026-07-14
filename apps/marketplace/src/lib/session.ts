import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Session token handling. Signup/signin store a student JWT in an httpOnly
 * cookie, and that cookie is the *only* source of identity. There is
 * deliberately no demo/guest fallback: a signed-out visitor is signed out, so
 * `Sign out` really signs you out and no payment is ever made on behalf of an
 * anonymous user.
 *
 * Browsing (home, discover, tutor profiles) stays public; anything that reads
 * or writes personal data requires a real session.
 */
const COOKIE = 'th_token';
const ONE_DAY = 60 * 60 * 24;

/** The signed-in student's JWT, or `null` when there is no session. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** True when a session cookie is present. */
export async function isAuthenticated(): Promise<boolean> {
  return (await getSessionToken()) !== null;
}

/**
 * The session token for a protected *page*, redirecting to the sign-in screen
 * when there is none. Server components only (it calls `redirect`).
 */
export async function requireSessionToken(locale: string): Promise<string> {
  const token = await getSessionToken();
  if (token === null) redirect(`/${locale}/login`);
  return token;
}

/** Thrown by {@link requireSessionTokenForAction} when there is no session. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('NOT_AUTHENTICATED');
    this.name = 'NotAuthenticatedError';
  }
}

/**
 * The session token for a Server Action. Throws {@link NotAuthenticatedError}
 * instead of redirecting, so callers can surface a "please sign in" prompt.
 */
export async function requireSessionTokenForAction(): Promise<string> {
  const token = await getSessionToken();
  if (token === null) throw new NotAuthenticatedError();
  return token;
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
