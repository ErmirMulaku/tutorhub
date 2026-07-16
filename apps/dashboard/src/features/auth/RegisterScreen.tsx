import { type FormEvent, type JSX, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import { API_URL } from '../../env';
import { isValidEmail, passwordError } from '../../lib/validation';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/auth-slice';

type Phase = 'form' | 'verify';

interface TutorSignupResult {
  data?: { tutorSignup?: { tutorId: string; requiresVerification: boolean; devCode: string | null } };
  errors?: { message: string }[];
}
interface TutorVerifyResult {
  data?: { tutorVerifyEmail?: { accessToken: string; tutorId: string } };
  errors?: { message: string }[];
}
interface TutorResendResult {
  data?: { resendTutorVerificationCode?: { devCode: string | null } };
  errors?: { message: string }[];
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as T;
}

export function RegisterScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (fullName.trim() === '') return 'Enter your full name.';
    if (!isValidEmail(email)) return 'Enter a valid email address.';
    const pwErr = passwordError(password);
    if (pwErr) return pwErr;
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  async function signUp(e: FormEvent): Promise<void> {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await graphql<TutorSignupResult>(
        `mutation($n:String!,$e:String!,$p:String!){ tutorSignup(fullName:$n,email:$e,password:$p){ tutorId requiresVerification devCode } }`,
        { n: fullName, e: email, p: password },
      );
      const payload = body.data?.tutorSignup;
      if (!payload) {
        setError(body.errors?.[0]?.message ?? 'Sign-up failed.');
        return;
      }
      setDevCode(payload.devCode);
      setPhase('verify');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

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
      dispatch(setCredentials({ token: payload.accessToken, tutorId: payload.tutorId }));
      // New tutors land in onboarding to complete and publish their profile.
      void navigate('/onboarding', { replace: true });
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
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'verify') {
    return (
      <div className="login">
        <div className="login__panel">
          <div className="login__brand">
            Tutor<strong>Hub</strong> <span className="login__eyebrow">FOR TUTORS</span>
          </div>
          <h1 className="login__title">Check your email</h1>
          <p className="login__subtitle">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>

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
            {devCode && (
              <p className="login__hint">Dev mode — no email configured, your code is {devCode}.</p>
            )}
            {error && <p className="login__error">{error}</p>}
            <Button type="submit" block disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & continue'}
            </Button>
          </form>

          <button type="button" className="login__resend" onClick={() => void resend()} disabled={busy}>
            Resend code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__brand">
          Tutor<strong>Hub</strong> <span className="login__eyebrow">FOR TUTORS</span>
        </div>
        <h1 className="login__title">Create your account</h1>
        <p className="login__subtitle">Start tutoring in minutes — it's free to join.</p>

        <form className="login__form" onSubmit={(e) => void signUp(e)}>
          <label className="login__field">
            <span>Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="login__field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="login__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="login__field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && <p className="login__error">{error}</p>}
          <Button type="submit" block disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="login__alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
