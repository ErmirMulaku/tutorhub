import { type FormEvent, type JSX, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import { API_URL } from '../../env';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/auth-slice';

const SEED_EMAIL = 'lena@tutor.example.com';

interface TutorSigninResult {
  data?: { tutorSignin?: { accessToken: string; tutorId: string } };
  errors?: { message: string }[];
}

export function LoginScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(SEED_EMAIL);
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($e:String!,$p:String!){ tutorSignin(email:$e,password:$p){ accessToken tutorId } }`,
          variables: { e: email, p: password },
        }),
      });
      const body = (await res.json()) as TutorSigninResult;
      const payload = body.data?.tutorSignin;
      if (!payload) {
        setError(body.errors?.[0]?.message ?? 'Sign-in failed.');
        return;
      }
      dispatch(setCredentials({ token: payload.accessToken, tutorId: payload.tutorId }));
      void navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function devLogin(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/tutor/dev-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError('Dev login failed — is the tutor seeded?');
        return;
      }
      const body = (await res.json()) as { accessToken: string; tutorId: string };
      dispatch(setCredentials({ token: body.accessToken, tutorId: body.tutorId }));
      void navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
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
            />
          </label>
          <label className="login__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="login__error">{error}</p>}
          <Button type="submit" block disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <button type="button" className="login__dev" onClick={() => void devLogin()} disabled={busy}>
          Use dev login (seeded tutor)
        </button>
      </div>
    </div>
  );
}
