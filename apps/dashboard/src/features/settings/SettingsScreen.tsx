import { type JSX, useEffect, useState } from 'react';
import { Button, Card, Skeleton } from '@ermulaku/ui';
import {
  type PayoutSchedule,
  useGetEarningsSummaryQuery,
  useGetTutorSettingsQuery,
  useSetPayoutScheduleMutation,
  useUpdateNotificationPrefsMutation,
  useUpdateTutorProfileMutation,
} from '../../store/api';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useToast } from '../../components/ToastProvider';

type Tab = 'profile' | 'payout' | 'notifications';

const NOTIFY_ROWS: { key: string; title: string; subtitle: string }[] = [
  { key: 'notifyBookings', title: 'New booking requests', subtitle: 'When a student requests a lesson' },
  { key: 'notifyReminders', title: 'Lesson reminders', subtitle: 'Before each upcoming lesson' },
  { key: 'notifyMessages', title: 'New messages', subtitle: 'When a student messages you' },
  { key: 'notifyPayouts', title: 'Payouts & earnings', subtitle: 'When a payout is sent' },
  { key: 'notifyTips', title: 'Tips & product news', subtitle: 'Occasional updates from TutorHub' },
];

export function SettingsScreen(): JSX.Element {
  const [tab, setTab] = useState<Tab>('profile');
  const { data: settings, isLoading } = useGetTutorSettingsQuery();
  const { data: earnings } = useGetEarningsSummaryQuery();
  const [saveProfile, { isLoading: savingProfile }] = useUpdateTutorProfileMutation();
  const [saveNotify] = useUpdateNotificationPrefsMutation();
  const [setSchedule] = useSetPayoutScheduleMutation();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: '', headline: '', about: '', timezone: '' });
  useEffect(() => {
    if (settings)
      setProfile({
        name: settings.name,
        headline: settings.headline ?? '',
        about: settings.about ?? '',
        timezone: settings.timezone,
      });
  }, [settings]);

  if (isLoading || !settings) return <Skeleton height={320} />;

  return (
    <div className="settings">
      <SegmentedTabs<Tab>
        segments={[
          { key: 'profile', label: 'Profile' },
          { key: 'payout', label: 'Payout' },
          { key: 'notifications', label: 'Notifications' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profile' && (
        <Card>
          <div className="settings__form">
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
            <label className="login__field">
              <span>Timezone</span>
              <input
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              />
            </label>
          </div>
          <Button
            size="sm"
            disabled={savingProfile}
            onClick={() => {
              void saveProfile(profile)
                .unwrap()
                .then(() => toast('Profile saved'));
            }}
          >
            Save profile
          </Button>
        </Card>
      )}

      {tab === 'payout' && (
        <Card>
          <h3 className="card-head__title">Payout method</h3>
          <div className="settings__method">{earnings?.payoutMethod ?? 'No method on file'}</div>
          <h3 className="card-head__title" style={{ marginTop: 18 }}>
            Payout schedule
          </h3>
          <div className="settings__schedule">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as PayoutSchedule[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`settings__sched${earnings?.payoutSchedule === s ? ' settings__sched--active' : ''}`}
                onClick={() => {
                  void setSchedule(s)
                    .unwrap()
                    .then(() => toast('Payout schedule updated'));
                }}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card>
          {NOTIFY_ROWS.map((row) => {
            const value = settings[row.key as keyof typeof settings] as boolean;
            return (
              <div key={row.key} className="settings__notify">
                <div>
                  <div className="settings__notify-title">{row.title}</div>
                  <div className="muted">{row.subtitle}</div>
                </div>
                <ToggleSwitch
                  checked={value}
                  onChange={(checked) => {
                    void saveNotify({ [row.key]: checked })
                      .unwrap()
                      .then(() => toast('Preferences saved'));
                  }}
                  label={row.title}
                />
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
