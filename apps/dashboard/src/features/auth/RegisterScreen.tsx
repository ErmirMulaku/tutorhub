import { type FormEvent, type JSX, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import { API_URL } from '../../env';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/auth-slice';

interface TutorSignupResult {
  data?: { tutorSignup?: { accessToken: string; tutorId: string } };
  errors?: { message: string }[];
}

export function RegisterScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signUp(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($n:String!,$e:String!,$p:String!){ tutorSignup(fullName:$n,email:$e,password:$p){ accessToken tutorId } }`,
          variables: { n: fullName, e: email, p: password },
        }),
      });
      const body = (await res.json()) as TutorSignupResult;
      const payload = body.data?.tutorSignup;
      if (!payload) {
        setError(body.errors?.[0]?.message ?? 'Sign-up failed.');
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
