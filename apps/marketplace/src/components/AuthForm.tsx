'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { signinAction, signupAction } from '@/lib/actions';

/** Combined sign in / sign up form backed by the auth Server Actions. */
export function AuthForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}): React.JSX.Element {
  const t = dict.auth;
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res =
        mode === 'signup'
          ? await signupAction(name, email, password)
          : await signinAction(email, password);
      if (res.ok) {
        router.push(`/${locale}/lessons`);
        router.refresh();
      } else {
        setError(res.error ?? t.error);
      }
    });
  };

  const isSignup = mode === 'signup';

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">{isSignup ? t.signupTitle : t.signinTitle}</h1>
      <p className="auth-card__sub">{isSignup ? t.signupSubtitle : t.signinSubtitle}</p>

      <div className="auth-card__oauth">
        <Button variant="secondary" block disabled>
          {t.continueGoogle}
        </Button>
        <Button variant="secondary" block disabled>
          {t.continueApple}
        </Button>
      </div>
      <div className="auth-card__divider">
        <span>{t.or}</span>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {isSignup && (
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
        )}
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
          <span>{isSignup ? t.createPassword : t.password}</span>
          <input
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="booking__error">{t.error}</p>}

        <Button type="submit" block disabled={isPending}>
          {isPending ? dict.common.loading : isSignup ? t.signUp : t.signIn}
        </Button>
      </form>

      <p className="auth-card__switch">
        {isSignup ? t.haveAccount : t.noAccount}{' '}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(isSignup ? 'signin' : 'signup');
            setError(null);
          }}
        >
          {isSignup ? t.switchToSignin : t.switchToSignup}
        </button>
      </p>
      <p className="auth-card__demo">{t.demoNote}</p>
    </div>
  );
}
