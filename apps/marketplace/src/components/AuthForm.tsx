'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import {
  oauthSigninAction,
  resendCodeAction,
  signinAction,
  signupAction,
  verifyEmailAction,
} from '@/lib/actions';

type Mode = 'signin' | 'signup';
type Step = 1 | 2 | 3;

/** Demo social identities — the provider handshake is simulated client-side. */
const OAUTH_DEMO: Record<'GOOGLE' | 'APPLE', { id: string; email: string; name: string }> = {
  GOOGLE: { id: 'google-demo-user', email: 'google.user@example.com', name: 'Google User' },
  APPLE: { id: 'apple-demo-user', email: 'apple.user@example.com', name: 'Apple User' },
};

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
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
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

/** Auth form: sign in, or a 3-step sign up (email → details → verify). */
export function AuthForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): React.JSX.Element {
  const t = dict.auth;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const finish = (): void => {
    router.push(`/${locale}/lessons`);
    router.refresh();
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    setStep(1);
    setError(null);
    setCode('');
    setDevCode(null);
  };

  const submitSignin = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signinAction(email, password);
      if (res.ok) finish();
      else setError(t.error);
    });
  };

  // Signup step 2 → create the account and move to the verify step.
  const submitDetails = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signupAction(name, email, password);
      if (res.ok) {
        setDevCode(res.devCode ?? null);
        setStep(3);
      } else {
        setError(res.error ?? t.error);
      }
    });
  };

  const submitVerify = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyEmailAction(email, code);
      if (res.ok) finish();
      else setError(res.error ?? t.error);
    });
  };

  const resend = (): void => {
    startTransition(async () => {
      const res = await resendCodeAction(email);
      if (res.ok) setDevCode(res.devCode ?? null);
    });
  };

  const oauth = (provider: 'GOOGLE' | 'APPLE'): void => {
    const demo = OAUTH_DEMO[provider];
    setError(null);
    startTransition(async () => {
      const res = await oauthSigninAction(provider, demo.id, demo.email, demo.name);
      if (res.ok) finish();
      else setError(t.error);
    });
  };

  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: t.stepEmail },
    { n: 2, label: t.stepDetails },
    { n: 3, label: t.stepVerify },
  ];

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          className="auth-tab"
          data-active={mode === 'signin'}
          onClick={() => switchMode('signin')}
        >
          {t.tabSignin}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className="auth-tab"
          data-active={mode === 'signup'}
          onClick={() => switchMode('signup')}
        >
          {t.tabSignup}
        </button>
      </div>

      {mode === 'signup' && (
        <ol className="auth-stepper" aria-label={t.tabSignup}>
          {steps.map((s) => (
            <li
              key={s.n}
              className="auth-stepper__item"
              data-state={step === s.n ? 'active' : step > s.n ? 'done' : 'todo'}
            >
              <span className="auth-stepper__circle">{step > s.n ? '✓' : s.n}</span>
              <span className="auth-stepper__label">{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {mode === 'signin' && (
        <>
          <h1 className="auth-card__title">{t.signinTitle}</h1>
          <p className="auth-card__sub">{t.signinSubtitle}</p>
          <form className="auth-form" onSubmit={submitSignin}>
            <label className="field">
              <span>{t.email}</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label-row">
                {t.password}
                <button type="button" className="link-btn auth-card__forgot">
                  {t.forgot}
                </button>
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="booking__error">{error}</p>}
            <Button type="submit" block disabled={isPending}>
              {isPending ? dict.common.loading : t.signIn}
            </Button>
          </form>
        </>
      )}

      {mode === 'signup' && step === 1 && (
        <>
          <h1 className="auth-card__title">{t.signupTitle}</h1>
          <p className="auth-card__sub">{t.signupSubtitle}</p>
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              setStep(2);
            }}
          >
            <label className="field">
              <span>{t.email}</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button type="submit" block>
              {t.continue}
            </Button>
          </form>
        </>
      )}

      {mode === 'signup' && step === 2 && (
        <>
          <h1 className="auth-card__title">{t.signupTitle}</h1>
          <p className="auth-card__sub">{t.signupSubtitle}</p>
          <form className="auth-form" onSubmit={submitDetails}>
            <label className="field">
              <span>{t.name}</span>
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t.createPassword}</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="booking__error">{error}</p>}
            <Button type="submit" block disabled={isPending}>
              {isPending ? dict.common.loading : t.continue}
            </Button>
            <button type="button" className="auth-card__back" onClick={() => setStep(1)}>
              {t.back}
            </button>
          </form>
        </>
      )}

      {mode === 'signup' && step === 3 && (
        <>
          <h1 className="auth-card__title">{t.verifyTitle}</h1>
          <p className="auth-card__sub">{interpolate(t.verifySubtitle, { email })}</p>
          <form className="auth-form" onSubmit={submitVerify}>
            <label className="field">
              <span>{t.code}</span>
              <input
                className="auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder={t.codePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            {devCode && <p className="auth-card__devcode">{interpolate(t.devCodeNote, { code: devCode })}</p>}
            {error && <p className="booking__error">{error}</p>}
            <Button type="submit" block disabled={isPending || code.length < 6}>
              {isPending ? dict.common.loading : t.verify}
            </Button>
            <div className="auth-card__verify-actions">
              <button type="button" className="auth-card__back" onClick={() => setStep(2)}>
                {t.back}
              </button>
              <button type="button" className="link-btn" onClick={resend} disabled={isPending}>
                {t.resend}
              </button>
            </div>
          </form>
        </>
      )}

      <div className="auth-card__divider">
        <span>{t.or}</span>
      </div>
      <div className="auth-card__oauth">
        <button type="button" className="oauth-btn" onClick={() => oauth('GOOGLE')} disabled={isPending}>
          <GoogleGlyph />
          {t.continueGoogle}
        </button>
        <button type="button" className="oauth-btn" onClick={() => oauth('APPLE')} disabled={isPending}>
          <AppleGlyph />
          {t.continueApple}
        </button>
      </div>

      <p className="auth-card__terms">{t.terms}</p>
    </div>
  );
}
