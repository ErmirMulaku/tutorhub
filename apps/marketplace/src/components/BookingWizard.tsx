'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Price } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { bookLessonAction, createLessonPaymentIntentAction } from '@/lib/actions';
import { formatFullDateTime, formatSlotTime } from '@/lib/datetime';
import type { DiscoverSubject, Slot } from '@/lib/queries';
import { LessonPaymentForm, STRIPE_PUBLISHABLE_KEY } from './LessonPaymentForm';

interface BookingWizardProps {
  tutorId: string;
  tutorName: string;
  timezone: string;
  hourlyCents: number;
  subjects: DiscoverSubject[];
  slots: Slot[];
  locale: Locale;
  currency: string;
  dict: Dictionary;
}

type Step = 1 | 2 | 3;
type Phase = 'form' | 'pay' | 'success' | 'error';

/**
 * Three-step booking flow (subject → time → confirm) rendered inline in the
 * profile aside. The date is chosen by the `DateTabs` above, which re-fetches
 * `slots` on the server; this component owns subject/slot/note selection and
 * runs the `bookLessonAction` Server Action.
 */
export function BookingWizard({
  tutorId,
  tutorName,
  timezone,
  hourlyCents,
  subjects,
  slots,
  locale,
  currency,
  dict,
}: BookingWizardProps): React.JSX.Element {
  const router = useRouter();
  const t = dict.booking;
  const [step, setStep] = useState<Step>(subjects.length > 1 ? 1 : 2);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [note, setNote] = useState('');
  const [agree, setAgree] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? '';

  const reset = (): void => {
    setStep(subjects.length > 1 ? 1 : 2);
    setSlot(null);
    setNote('');
    setAgree(false);
    setClientSecret(null);
    setPhase('form');
  };

  const confirm = (): void => {
    if (!slot) return;
    const input = { tutorId, subjectId, startTime: slot.start };
    startTransition(async () => {
      // Paid flow only when the browser can also confirm the card. Otherwise
      // (no publishable key, or the API has no Stripe key) book for free as
      // before so local/demo setups keep working.
      if (STRIPE_PUBLISHABLE_KEY) {
        const intent = await createLessonPaymentIntentAction(input);
        if (intent.ok && intent.clientSecret) {
          setClientSecret(intent.clientSecret);
          setPhase('pay');
          return;
        }
        if (!intent.paymentsDisabled) {
          setPhase('error');
          return;
        }
      }
      const result = await bookLessonAction(input);
      if (result.ok) {
        setPhase('success');
        router.refresh();
      } else {
        setPhase('error');
      }
    });
  };

  if (phase === 'pay' && slot && clientSecret) {
    return (
      <div className="wizard">
        <h3 className="wizard__h">{t.payTitle}</h3>
        <p className="booking__summary">
          {interpolate(t.summary, { subject: subjectName, tutor: tutorName })} ·{' '}
          {formatFullDateTime(slot.start, timezone, locale)}
        </p>
        <LessonPaymentForm
          clientSecret={clientSecret}
          amountLabel={new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
            hourlyCents / 100,
          )}
          dict={dict}
          onSuccess={() => {
            setPhase('success');
            router.refresh();
          }}
        />
        <button type="button" className="wizard__back" onClick={reset}>
          {t.cancel}
        </button>
      </div>
    );
  }

  if (phase === 'success' && slot) {
    return (
      <div className="wizard wizard--done">
        <p className="booking__success">{t.success}</p>
        <p className="booking__line">
          {interpolate(t.successBody, {
            subject: subjectName,
            time: formatFullDateTime(slot.start, timezone, locale),
          })}
        </p>
        <Button block onClick={reset}>
          {t.bookAnother}
        </Button>
      </div>
    );
  }

  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: t.stepperSubject },
    { n: 2, label: t.stepperTime },
    { n: 3, label: t.stepperConfirm },
  ];

  return (
    <div className="wizard">
      <ol className="auth-stepper wizard__stepper" aria-label={t.stepConfirm}>
        {steps.map((s) => (
          <li
            key={s.n}
            className="auth-stepper__item"
            data-state={step === s.n ? 'active' : step > s.n ? 'done' : 'todo'}
          >
            <span className="auth-stepper__circle">{step > s.n ? '✓' : s.n}</span>
            <span className="auth-stepper__label">{s.label}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="wizard__body">
          <h3 className="wizard__h">{t.stepSubject}</h3>
          <div className="wizard__subjects">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                className="wizard__chip"
                data-active={s.id === subjectId}
                onClick={() => setSubjectId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <Button block onClick={() => setStep(2)} disabled={!subjectId}>
            {t.next}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="wizard__body">
          <h3 className="wizard__h">{t.stepSlot}</h3>
          {slots.length > 0 ? (
            <div className="slots">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  className="slot slot--btn"
                  data-active={slot?.start === s.start}
                  onClick={() => {
                    setSlot(s);
                    setStep(3);
                  }}
                >
                  {formatSlotTime(s.start, timezone, locale)}
                </button>
              ))}
            </div>
          ) : (
            <p className="profile__muted">{dict.profile.noSlots}</p>
          )}
          {subjects.length > 1 && (
            <button type="button" className="wizard__back" onClick={() => setStep(1)}>
              {t.back}
            </button>
          )}
        </div>
      )}

      {step === 3 && slot && (
        <div className="wizard__body">
          <h3 className="wizard__h">{t.stepConfirm}</h3>
          <p className="booking__summary">
            {interpolate(t.summary, { subject: subjectName, tutor: tutorName })}
          </p>
          <dl className="booking__details">
            <div>
              <dt>{t.when}</dt>
              <dd>{formatFullDateTime(slot.start, timezone, locale)}</dd>
            </div>
            <div>
              <dt>{t.duration}</dt>
              <dd>{t.durationValue}</dd>
            </div>
            <div>
              <dt>{t.total}</dt>
              <dd>
                <Price cents={hourlyCents} currency={currency} locale={locale} />
              </dd>
            </div>
          </dl>

          <label className="booking__field">
            <span>{t.noteLabel}</span>
            <textarea
              rows={2}
              value={note}
              placeholder={t.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <label className="wizard__terms">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{t.terms}</span>
          </label>

          <p className="booking__note">{t.signInNote}</p>
          {phase === 'error' && <p className="booking__error">{t.error}</p>}

          <div className="booking__actions">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={isPending}>
              {t.back}
            </Button>
            <Button onClick={confirm} disabled={isPending || !agree}>
              {isPending ? dict.common.loading : t.confirm}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
