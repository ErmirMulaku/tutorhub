'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { appleSigninAction, googleSigninAction } from '@/lib/actions';

// Minimal typings for the provider SDKs we load at runtime (avoids `any`).
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}
interface AppleAuth {
  init(config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }): void;
  signIn(): Promise<{ authorization: { id_token: string; code: string } }>;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
    AppleID?: { auth: AppleAuth };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const APPLE_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/** Load an external script once, resolving when ready. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(src)));
      }
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.addEventListener('load', () => {
      el.dataset.loaded = 'true';
      resolve();
    });
    el.addEventListener('error', () => reject(new Error(src)));
    document.head.appendChild(el);
  });
}

function GoogleGlyph(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleGlyph(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M12.27 9.54c-.02-1.86 1.52-2.75 1.59-2.8-.87-1.27-2.22-1.44-2.7-1.46-1.15-.12-2.24.67-2.82.67-.58 0-1.48-.65-2.43-.64-1.25.02-2.4.73-3.05 1.85-1.3 2.26-.33 5.6.93 7.43.62.9 1.36 1.9 2.32 1.86.93-.04 1.28-.6 2.4-.6 1.12 0 1.44.6 2.42.58 1-.02 1.63-.91 2.24-1.81.71-1.04 1-2.05 1.01-2.1-.02-.01-1.94-.74-1.96-2.95-.02-.01-.01-.02 0-.03zM10.6 3.9c.51-.62.86-1.49.76-2.35-.74.03-1.63.49-2.16 1.11-.47.55-.89 1.43-.78 2.27.82.07 1.67-.42 2.18-1.03z" />
    </svg>
  );
}

interface OAuthButtonsProps {
  locale: Locale;
  dict: Dictionary;
  onError: () => void;
  disabled?: boolean;
}

/**
 * Social sign-in. When `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_APPLE_CLIENT_ID`
 * are configured, this uses the real provider SDKs (Google Identity Services and
 * Sign in with Apple JS) and verifies the returned ID token on the server.
 * A provider without its client id configured is disabled — there is deliberately
 * no unverified fallback, since that would let anyone sign in as anyone.
 */
export function OAuthButtons({ locale, dict, onError, disabled }: OAuthButtonsProps): React.JSX.Element {
  const t = dict.auth;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

  const finish = (): void => {
    router.push(`/${locale}/lessons`);
    router.refresh();
  };

  // Real Google Identity Services button (ID-token flow).
  useEffect(() => {
    if (!googleClientId || !googleBtnRef.current) return;
    let cancelled = false;
    void loadScript(GIS_SRC).then(() => {
      if (cancelled || !window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (resp) => {
          startTransition(async () => {
            const res = await googleSigninAction(resp.credential);
            if (res.ok) finish();
            else onError();
          });
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 360,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  // Initialise Sign in with Apple (popup flow) when configured.
  useEffect(() => {
    if (!appleClientId) return;
    let cancelled = false;
    void loadScript(APPLE_SRC).then(() => {
      if (cancelled || !window.AppleID) return;
      window.AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: `${window.location.origin}/${locale}/login`,
        usePopup: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [appleClientId, locale]);

  const appleSignIn = (): void => {
    const appleId = window.AppleID;
    if (!appleClientId || !appleId) return; // not configured — button is disabled
    startTransition(async () => {
      try {
        const data = await appleId.auth.signIn();
        const res = await appleSigninAction(data.authorization.id_token);
        if (res.ok) finish();
        else onError();
      } catch {
        onError();
      }
    });
  };

  // A provider with no client id configured cannot verify anything, so its
  // button is disabled rather than falling back to an unverified sign-in.
  return (
    <div className="auth-card__oauth">
      {googleClientId ? (
        <div ref={googleBtnRef} className="gsi-button" />
      ) : (
        <button type="button" className="oauth-btn" disabled title={t.oauthUnavailable}>
          <GoogleGlyph />
          {t.continueGoogle}
        </button>
      )}
      <button
        type="button"
        className="oauth-btn"
        onClick={appleSignIn}
        disabled={pending || disabled || !appleClientId}
        title={appleClientId ? undefined : t.oauthUnavailable}
      >
        <AppleGlyph />
        {t.continueApple}
      </button>
    </div>
  );
}
