import { type JSX, useEffect, useState } from 'react';
import { Button, Skeleton } from '@ermulaku/ui';
import {
  type PayoutSchedule,
  useGetConnectStatusQuery,
  useGetEarningsSummaryQuery,
  useSetPayoutMethodMutation,
  useSetPayoutScheduleMutation,
  useStartConnectOnboardingMutation,
} from '../../store/api';
import { useToast } from '../../components/ToastProvider';

const SCHEDULES: PayoutSchedule[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

/**
 * Link a payout method + pick a payout schedule. Shared by the onboarding
 * wizard and (potentially) the earnings/settings screens. Saving invalidates
 * the `Earnings` tag so every summary consumer refetches.
 */
/** Stripe Connect onboarding status + call-to-action, shared across payout UIs. */
export function ConnectPayouts(): JSX.Element {
  const { data: connect } = useGetConnectStatusQuery();
  const [startOnboarding, { isLoading: linking }] = useStartConnectOnboardingMutation();
  const toast = useToast();

  function onConnect(): void {
    void startOnboarding()
      .unwrap()
      .then(({ url }) => {
        // Hosted Stripe onboarding; Stripe redirects back to /earnings when done.
        window.location.href = url;
      })
      .catch(() => toast('Could not start payout onboarding — is Stripe configured?'));
  }

  return (
    <div className="payout-editor__connect">
      {connect?.payoutsEnabled ? (
        <span className="th-pill th-pill--info">Payouts enabled via Stripe</span>
      ) : (
        <>
          <Button size="sm" variant="secondary" onClick={onConnect} disabled={linking}>
            {linking
              ? 'Opening Stripe…'
              : connect?.onboarded
                ? 'Finish payout setup (Stripe)'
                : 'Connect payouts with Stripe'}
          </Button>
          <span className="muted payout-editor__connect-hint">
            Secure onboarding hosted by Stripe — takes ~2 minutes.
          </span>
        </>
      )}
    </div>
  );
}

export function PayoutEditor(): JSX.Element {
  const { data, isLoading } = useGetEarningsSummaryQuery();
  const [saveMethod, { isLoading: saving }] = useSetPayoutMethodMutation();
  const [setSchedule] = useSetPayoutScheduleMutation();
  const toast = useToast();

  const [method, setMethod] = useState('');

  useEffect(() => {
    if (data) setMethod(data.payoutMethod ?? '');
  }, [data]);

  function onSaveMethod(): void {
    if (!method.trim()) return;
    void saveMethod(method.trim())
      .unwrap()
      .then(() => toast('Payout method saved'));
  }

  if (isLoading || !data) return <Skeleton height={200} />;

  return (
    <div className="payout-editor">
      <ConnectPayouts />
      <label className="login__field">
        <span>Payout method</span>
        <input
          value={method}
          placeholder="e.g. Visa •••• 4242"
          onChange={(e) => setMethod(e.target.value)}
        />
      </label>
      <Button size="sm" onClick={onSaveMethod} disabled={saving}>
        {saving ? 'Saving…' : 'Save payout method'}
      </Button>

      <div className="payout-editor__schedule">
        <span className="login__field">
          <span>Payout schedule</span>
        </span>
        <div className="settings__schedule">
          {SCHEDULES.map((s) => (
            <button
              key={s}
              type="button"
              className={`settings__sched${data.payoutSchedule === s ? ' settings__sched--active' : ''}`}
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
      </div>
    </div>
  );
}
