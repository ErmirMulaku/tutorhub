'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, Price } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { bookLessonAction } from '@/lib/actions';
import { formatFullDateTime, formatSlotTime } from '@/lib/datetime';
import type { DiscoverSubject, Slot } from '@/lib/queries';

interface BookingPanelProps {
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

type Phase = 'form' | 'success' | 'error';

/**
 * Availability slots that open the booking sheet (a GPU-animated `Modal`).
 * Confirming runs the `bookLessonAction` Server Action; on success the slot list
 * is refreshed so the booked time disappears.
 */
export function BookingPanel({
  tutorId,
  tutorName,
  timezone,
  hourlyCents,
  subjects,
  slots,
  locale,
  currency,
  dict,
}: BookingPanelProps): React.JSX.Element {
  const router = useRouter();
  const t = dict.booking;
  const [slot, setSlot] = useState<Slot | null>(null);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [phase, setPhase] = useState<Phase>('form');
  const [isPending, startTransition] = useTransition();

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? '';

  const open = (next: Slot): void => {
    setSlot(next);
    setPhase('form');
  };

  const close = (): void => setSlot(null);

  const confirm = (): void => {
    if (!slot) return;
    startTransition(async () => {
      const result = await bookLessonAction({ tutorId, subjectId, startTime: slot.start });
      if (result.ok) {
        setPhase('success');
        router.refresh();
      } else {
        setPhase('error');
      }
    });
  };

  return (
    <>
      {slots.length > 0 ? (
        <div className="slots">
          {slots.map((s) => (
            <button key={s.start} type="button" className="slot slot--btn" onClick={() => open(s)}>
              {formatSlotTime(s.start, timezone, locale)}
            </button>
          ))}
        </div>
      ) : (
        <p className="profile__muted">{dict.profile.noSlots}</p>
      )}

      <Modal open={slot !== null} onClose={close} title={t.title}>
        {slot && phase === 'success' ? (
          <div className="booking">
            <p className="booking__success">{t.success}</p>
            <p className="booking__line">
              {interpolate(t.successBody, {
                subject: subjectName,
                time: formatFullDateTime(slot.start, timezone, locale),
              })}
            </p>
            <Button block onClick={close}>
              {t.close}
            </Button>
          </div>
        ) : slot ? (
          <div className="booking">
            <p className="booking__summary">
              {interpolate(t.summary, { subject: subjectName, tutor: tutorName })}
            </p>

            {subjects.length > 1 && (
              <label className="booking__field">
                <span>{t.chooseSubject}</span>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <dl className="booking__details">
              <div>
                <dt>{t.when}</dt>
                <dd>{formatFullDateTime(slot.start, timezone, locale)}</dd>
              </div>
              <div>
                <dt>{t.price}</dt>
                <dd>
                  <Price cents={hourlyCents} currency={currency} locale={locale} />
                </dd>
              </div>
            </dl>

            <p className="booking__note">{t.signInNote}</p>
            {phase === 'error' && <p className="booking__error">{t.error}</p>}

            <div className="booking__actions">
              <Button variant="secondary" onClick={close} disabled={isPending}>
                {t.cancel}
              </Button>
              <Button onClick={confirm} disabled={isPending}>
                {isPending ? dict.common.loading : t.confirm}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
