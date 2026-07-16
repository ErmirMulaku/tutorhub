import { type FormEvent, type JSX, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import { isValidEmail, passwordError } from '../../lib/validation';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/auth-slice';
import { graphql, type GraphqlError } from './api';
import { VerifyPanel } from './VerifyPanel';

type Phase = 'form' | 'verify';

interface TutorSignupResult {
  data?: {
    tutorSignup?: { tutorId: string; requiresVerification: boolean; devCode: string | null };
  };
  errors?: GraphqlError[];
}

export function RegisterScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  if (phase === 'verify') {
    return (
      <div className="login">
        <div className="login__panel">
          <div className="login__brand">
            Tutor<strong>Hub</strong> <span className="login__eyebrow">FOR TUTORS</span>
          </div>
          <VerifyPanel
            email={email}
            initialDevCode={devCode}
            subtitle={
              <p className="login__subtitle">
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
            }
            onVerified={(token, tutorId) => {
              dispatch(setCredentials({ token, tutorId }));
              // New tutors land in onboarding to complete and publish their profile.
              void navigate('/onboarding', { replace: true });
            }}
          />
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
