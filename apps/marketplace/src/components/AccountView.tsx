'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@ermulaku/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import {
  changePasswordAction,
  setTwoFactorAction,
  updateNotificationPrefsAction,
  updateProfileAction,
} from '@/lib/actions';
import type { StudentMe } from '@/lib/queries';

type Tab = 'personal' | 'security' | 'notifs';

interface ToggleProps {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function Toggle({ label, sub, checked, onChange }: ToggleProps): React.JSX.Element {
  return (
    <div className="toggle-row">
      <div>
        <strong className="toggle-row__label">{label}</strong>
        <span className="toggle-row__sub">{sub}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        data-on={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

/** Account settings with personal / security / notifications tabs. */
export function AccountView({
  me,
  dict,
}: {
  me: StudentMe;
  dict: Dictionary;
}): React.JSX.Element {
  const t = dict.account;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('personal');
  const [, startTransition] = useTransition();

  const [name, setName] = useState(me.fullName);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [savedProfile, setSavedProfile] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const [twoFA, setTwoFA] = useState(me.twoFactorEnabled);
  const [prefs, setPrefs] = useState({
    notifyEmail: me.notifyEmail,
    notifySms: me.notifySms,
    notifyReminders: me.notifyReminders,
    notifyPromos: me.notifyPromos,
  });

  const saveProfile = (e: React.FormEvent): void => {
    e.preventDefault();
    startTransition(async () => {
      await updateProfileAction({ fullName: name, phone });
      setSavedProfile(true);
      router.refresh();
      setTimeout(() => setSavedProfile(false), 2000);
    });
  };

  const savePassword = (e: React.FormEvent): void => {
    e.preventDefault();
    setPwError(null);
    if (next !== confirm) {
      setPwError(t.passwordMismatch);
      return;
    }
    startTransition(async () => {
      const res = await changePasswordAction(current, next);
      if (res.ok) {
        setPwSaved(true);
        setCurrent('');
        setNext('');
        setConfirm('');
        setTimeout(() => setPwSaved(false), 2000);
      } else {
        setPwError(t.error);
      }
    });
  };

  const toggle2FA = (val: boolean): void => {
    setTwoFA(val);
    startTransition(() => setTwoFactorAction(val).then(() => undefined));
  };

  const setPref = (key: keyof typeof prefs, val: boolean): void => {
    setPrefs((p) => ({ ...p, [key]: val }));
    startTransition(() => updateNotificationPrefsAction({ [key]: val }).then(() => undefined));
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'personal', label: t.tabPersonal },
    { id: 'security', label: t.tabSecurity },
    { id: 'notifs', label: t.tabNotifs },
  ];

  return (
    <div className="settings">
      <div className="tabs" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            className="tab"
            data-active={tab === tb.id}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && (
        <Card>
          <form className="auth-form" onSubmit={saveProfile}>
            <label className="field">
              <span>{t.name}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>{t.email}</span>
              <input value={me.email} readOnly disabled />
            </label>
            <label className="field">
              <span>{t.phone}</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <Button type="submit">{savedProfile ? t.saved : t.save}</Button>
          </form>
        </Card>
      )}

      {tab === 'security' && (
        <div className="stack">
          <Card>
            <form className="auth-form" onSubmit={savePassword}>
              <label className="field">
                <span>{t.currentPassword}</span>
                <input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t.newPassword}</span>
                <input
                  type="password"
                  minLength={6}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t.confirmPassword}</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              {pwError && <p className="booking__error">{pwError}</p>}
              <Button type="submit">{pwSaved ? t.saved : t.updatePassword}</Button>
            </form>
          </Card>

          <Card>
            <Toggle
              label={t.twoFactor}
              sub={t.twoFactorSub}
              checked={twoFA}
              onChange={toggle2FA}
            />
          </Card>

          <Card className="danger-zone">
            <h3 className="danger-zone__title">{t.danger}</h3>
            <p className="danger-zone__sub">{t.dangerSub}</p>
            <Button variant="secondary" disabled>
              {t.delete}
            </Button>
          </Card>
        </div>
      )}

      {tab === 'notifs' && (
        <Card>
          <div className="stack">
            <Toggle
              label={t.notifEmail}
              sub={t.notifEmailSub}
              checked={prefs.notifyEmail}
              onChange={(v) => setPref('notifyEmail', v)}
            />
            <Toggle
              label={t.notifSms}
              sub={t.notifSmsSub}
              checked={prefs.notifySms}
              onChange={(v) => setPref('notifySms', v)}
            />
            <Toggle
              label={t.notifReminders}
              sub={t.notifRemindersSub}
              checked={prefs.notifyReminders}
              onChange={(v) => setPref('notifyReminders', v)}
            />
            <Toggle
              label={t.notifPromos}
              sub={t.notifPromosSub}
              checked={prefs.notifyPromos}
              onChange={(v) => setPref('notifyPromos', v)}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
