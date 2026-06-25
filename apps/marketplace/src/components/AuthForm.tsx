'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { resendCodeAction, signinAction, signupAction, verifyEmailAction } from '@/lib/actions';
import { OAuthButtons } from './OAuthButtons';

type Mode = 'signin' | 'signup';
type Step = 1 | 2 | 3;

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
      <OAuthButtons
        locale={locale}
        dict={dict}
        disabled={isPending}
        onError={() => setError(t.error)}
      />

      <p className="auth-card__terms">{t.terms}</p>
    </div>
  );
}
