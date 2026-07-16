import { type FormEvent, type JSX, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import { isValidEmail } from '../../lib/validation';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/auth-slice';
import { graphql, type GraphqlError, isEmailNotVerified } from './api';
import { VerifyPanel } from './VerifyPanel';

const SEED_EMAIL = 'lena@tutor.example.com';

interface TutorSigninResult {
  data?: { tutorSignin?: { accessToken: string; tutorId: string } };
  errors?: GraphqlError[];
}

export function LoginScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(SEED_EMAIL);
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when the password was right but the address was never verified.
  const [unverified, setUnverified] = useState(false);

  function onAuthenticated(token: string, tutorId: string): void {
    dispatch(setCredentials({ token, tutorId }));
    void navigate('/dashboard', { replace: true });
  }

  async function signIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password === '') {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await graphql<TutorSigninResult>(
        `mutation($e:String!,$p:String!){ tutorSignin(email:$e,password:$p){ accessToken tutorId } }`,
        { e: email, p: password },
      );
      const payload = body.data?.tutorSignin;
      if (!payload) {
        // Credentials were right, the address just was not verified — send them
        // to the code step rather than repeating "sign-in failed" forever.
        if (isEmailNotVerified(body.errors)) {
          setUnverified(true);
          return;
        }
        setError(body.errors?.[0]?.message ?? 'Sign-in failed.');
        return;
      }
      onAuthenticated(payload.accessToken, payload.tutorId);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (unverified) {
    return (
      <div className="login">
        <div className="login__panel">
          <div className="login__brand">
            Tutor<strong>Hub</strong> <span className="login__eyebrow">FOR TUTORS</span>
          </div>
          <VerifyPanel
            email={email}
            subtitle={
              <p className="login__subtitle">
                Your account isn’t verified yet. Enter the code we sent to <strong>{email}</strong>,
                or request a new one.
              </p>
            }
            onVerified={onAuthenticated}
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
        <h1 className="login__title">Welcome back</h1>
        <p className="login__subtitle">Sign in to manage your tutoring practice.</p>

        <form className="login__form" onSubmit={(e) => void signIn(e)}>
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
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="login__error">{error}</p>}
          <Button type="submit" block disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="login__alt">
          New to TutorHub? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
