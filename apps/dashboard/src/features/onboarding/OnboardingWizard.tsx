import { type JSX, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import {
  useGetTutorSettingsQuery,
  usePublishProfileMutation,
  useUpdateTutorProfileMutation,
} from '../../store/api';

const STEPS = ['Welcome', 'Profile', 'Subjects', 'Availability', 'Payout', 'Publish'];

export function OnboardingWizard(): JSX.Element {
  const navigate = useNavigate();
  const { data: settings } = useGetTutorSettingsQuery();
  const [saveProfile] = useUpdateTutorProfileMutation();
  const [publish, { isLoading: publishing }] = usePublishProfileMutation();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ name: '', headline: '', about: '' });

  // Prefill once settings load.
  if (settings && profile.name === '' && step === 1) {
    setProfile({ name: settings.name, headline: settings.headline ?? '', about: settings.about ?? '' });
  }

  function next(): void {
    if (step === 2) void saveProfile(profile);
    if (step < STEPS.length) setStep(step + 1);
  }
  function finish(): void {
    void publish()
      .unwrap()
      .then(() => navigate('/dashboard', { replace: true }));
  }

  return (
    <div className="ob">
      <aside className="ob__panel">
        <div className="ob__brand">
          Tutor<strong>Hub</strong>
        </div>
        <h2 className="ob__panel-title">Let's get your profile ready</h2>
        <ol className="ob__stepper">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? 'done' : n === step ? 'current' : 'upcoming';
            return (
              <li key={label} className={`ob__step ob__step--${state}`}>
                <span className="ob__step-dot">{n < step ? '✓' : ''}</span>
                {label}
              </li>
            );
          })}
        </ol>
        <p className="ob__panel-foot">Takes about 5 minutes</p>
      </aside>

      <section className="ob__content">
        <button type="button" className="ob__close" onClick={() => void navigate('/dashboard')}>
          ✕
        </button>
        <div className="ob__body">
          {step === 1 && (
            <>
              <h1>Welcome to TutorHub</h1>
              <p className="muted">A few quick steps to get your tutoring profile live.</p>
              <ul className="ob__features">
                <li>Build your profile</li>
                <li>Set your hours & rates</li>
                <li>Get paid securely</li>
              </ul>
            </>
          )}
          {step === 2 && (
            <>
              <h1>Your profile</h1>
              <label className="login__field">
                <span>Display name</span>
                <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </label>
              <label className="login__field">
                <span>Headline</span>
                <input
                  value={profile.headline}
                  onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                />
              </label>
              <label className="login__field">
                <span>About</span>
                <textarea
                  rows={4}
                  value={profile.about}
                  onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                />
              </label>
            </>
          )}
          {step === 3 && (
            <>
              <h1>Subjects & pricing</h1>
              <p className="muted">Add the subjects you teach and set a price — manage these any time in Catalog.</p>
            </>
          )}
          {step === 4 && (
            <>
              <h1>Availability</h1>
              <p className="muted">Set the days and hours students can book — you can fine-tune this in Availability.</p>
            </>
          )}
          {step === 5 && (
            <>
              <h1>Get paid</h1>
              <p className="muted">Link a payout method so your earnings reach you automatically.</p>
            </>
          )}
          {step === 6 && (
            <>
              <div className="ob__check">✓</div>
              <h1>You're all set, {profile.name.split(' ')[0] || 'there'}!</h1>
              <p className="muted">Publish your profile to start receiving bookings.</p>
            </>
          )}
        </div>
        <div className="ob__footer">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length ? (
            <Button onClick={next}>{step === 1 ? 'Get started' : 'Continue'}</Button>
          ) : (
            <Button onClick={finish} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish profile'}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
