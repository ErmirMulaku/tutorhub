import { type FormEvent, type JSX, useState } from 'react';
import { Button } from '@ermulaku/ui';
import { graphql, type GraphqlError } from './api';

interface TutorVerifyResult {
  data?: { tutorVerifyEmail?: { accessToken: string; tutorId: string } };
  errors?: GraphqlError[];
}
interface TutorResendResult {
  data?: { resendTutorVerificationCode?: { devCode: string | null } };
  errors?: GraphqlError[];
}

interface Props {
  email: string;
  /** A code to display when the API has no email transport (local dev only). */
  initialDevCode?: string | null;
  /** Copy above the form — the two entry points arrive here for different reasons. */
  subtitle: JSX.Element;
  onVerified: (token: string, tutorId: string) => void;
}

/**
 * The 6-digit email verification step.
 *
 * Shared by sign-up (straight after registering) and sign-in (when the account
 * exists but was never verified) — both need the same exchange, and sign-in
 * would otherwise be a dead end for anyone who closed the tab before verifying.
 */
export function VerifyPanel({ email, initialDevCode = null, subtitle, onVerified }: Props): JSX.Element {
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(initialDevCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function verify(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await graphql<TutorVerifyResult>(
        `mutation($e:String!,$c:String!){ tutorVerifyEmail(email:$e,code:$c){ accessToken tutorId } }`,
        { e: email, c: code.trim() },
      );
      const payload = body.data?.tutorVerifyEmail;
      if (!payload) {
        setError(body.errors?.[0]?.message ?? 'That code is invalid or has expired.');
        return;
      }
      onVerified(payload.accessToken, payload.tutorId);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function resend(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const body = await graphql<TutorResendResult>(
        `mutation($e:String!){ resendTutorVerificationCode(email:$e){ devCode } }`,
        { e: email },
      );
      setDevCode(body.data?.resendTutorVerificationCode?.devCode ?? null);
      setSent(true);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="login__title">Check your email</h1>
      {subtitle}

      <form className="login__form" onSubmit={(e) => void verify(e)}>
        <label className="login__field">
          <span>Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
            autoFocus
          />
        </label>
        {devCode !== null && (
          <p className="login__hint">Dev mode — no email configured, your code is {devCode}.</p>
        )}
        {sent && devCode === null && <p className="login__hint">A new code is on its way.</p>}
        {error !== null && <p className="login__error">{error}</p>}
        <Button type="submit" block disabled={busy}>
          {busy ? 'Verifying…' : 'Verify & continue'}
        </Button>
      </form>

      <button type="button" className="login__resend" onClick={() => void resend()} disabled={busy}>
        Resend code
      </button>
    </>
  );
}
