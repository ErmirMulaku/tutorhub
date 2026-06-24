'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Modal, StarRating } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import {
  cancelBookingAction,
  leaveReviewAction,
  rescheduleBookingAction,
} from '@/lib/actions';
import { formatFullDateTime } from '@/lib/datetime';
import type { MyBooking } from '@/lib/queries';

interface LessonsViewProps {
  bookings: MyBooking[];
  locale: Locale;
  dict: Dictionary;
}

const UPCOMING = new Set(['PENDING', 'CONFIRMED']);

type Dialog =
  | { kind: 'cancel'; booking: MyBooking }
  | { kind: 'reschedule'; booking: MyBooking }
  | { kind: 'review'; booking: MyBooking }
  | null;

/** Upcoming / past tabs with cancel, reschedule and review flows. */
export function LessonsView({ bookings, locale, dict }: LessonsViewProps): React.JSX.Element {
  const t = dict.lessons;
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reschedule form + review form local state.
  const [when, setWhen] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const upcoming = bookings.filter((b) => UPCOMING.has(b.status));
  const past = bookings.filter((b) => !UPCOMING.has(b.status));
  const shown = tab === 'upcoming' ? upcoming : past;

  const close = (): void => {
    setDialog(null);
    setError(null);
    setWhen('');
    setRating(5);
    setComment('');
  };

  const statusLabel = (status: MyBooking['status']): string =>
    t[`status${status}` as keyof typeof t];

  const onCancel = (): void => {
    if (dialog?.kind !== 'cancel') return;
    startTransition(async () => {
      const res = await cancelBookingAction(dialog.booking.id);
      if (res.ok) {
        close();
        router.refresh();
      } else setError(res.error ?? 'error');
    });
  };

  const onReschedule = (): void => {
    if (dialog?.kind !== 'reschedule' || !when) return;
    startTransition(async () => {
      const res = await rescheduleBookingAction(dialog.booking.id, new Date(when).toISOString());
      if (res.ok) {
        close();
        router.refresh();
      } else setError(res.error ?? 'error');
    });
  };

  const onReview = (): void => {
    if (dialog?.kind !== 'review') return;
    startTransition(async () => {
      const res = await leaveReviewAction(dialog.booking.id, rating, comment || null);
      if (res.ok) {
        close();
        router.refresh();
      } else setError(res.error ?? 'error');
    });
  };

  return (
    <>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          className="tab"
          data-active={tab === 'upcoming'}
          onClick={() => setTab('upcoming')}
        >
          {t.tabUpcoming} ({upcoming.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'past'}
          className="tab"
          data-active={tab === 'past'}
          onClick={() => setTab('past')}
        >
          {t.tabPast} ({past.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <Card className="empty-state">
          <p className="empty-state__title">{t.empty}</p>
          <p className="empty-state__sub">{t.emptySub}</p>
        </Card>
      ) : (
        <ul className="lesson-list">
          {shown.map((b) => (
            <li key={b.id}>
              <Card className="lesson-card">
                <Avatar name={b.tutor.name} size="md" />
                <div className="lesson-card__main">
                  <strong className="lesson-card__subject">{b.subject.name}</strong>
                  <span className="lesson-card__sub">
                    {interpolate(t.with, { tutor: b.tutor.name })}
                  </span>
                  <span className="lesson-card__when">
                    {formatFullDateTime(b.startTime, b.tutor.timezone, locale)}
                  </span>
                </div>
                <div className="lesson-card__side">
                  <span className={`status-pill status-pill--${b.status.toLowerCase()}`}>
                    {statusLabel(b.status)}
                  </span>
                  <div className="lesson-card__actions">
                    {UPCOMING.has(b.status) ? (
                      <>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setDialog({ kind: 'reschedule', booking: b })}
                        >
                          {t.reschedule}
                        </button>
                        <button
                          type="button"
                          className="link-btn link-btn--danger"
                          onClick={() => setDialog({ kind: 'cancel', booking: b })}
                        >
                          {t.cancel}
                        </button>
                      </>
                    ) : b.status === 'COMPLETED' ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setDialog({ kind: 'review', booking: b })}
                      >
                        {t.review}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Cancel */}
      <Modal open={dialog?.kind === 'cancel'} onClose={close} title={t.cancelTitle}>
        <div className="dialog">
          <p>{t.cancelBody}</p>
          {error && <p className="booking__error">{t.statusCANCELLED}</p>}
          <div className="booking__actions">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              {t.keep}
            </Button>
            <Button onClick={onCancel} disabled={isPending}>
              {isPending ? dict.common.loading : t.confirmCancel}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule */}
      <Modal open={dialog?.kind === 'reschedule'} onClose={close} title={t.rescheduleTitle}>
        <div className="dialog">
          <label className="booking__field">
            <span>{t.reschedule}</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
          {error && <p className="booking__error">{dict.account.error}</p>}
          <div className="booking__actions">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              {dict.common.cancel}
            </Button>
            <Button onClick={onReschedule} disabled={isPending || !when}>
              {isPending ? dict.common.loading : t.reschedule}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review */}
      <Modal open={dialog?.kind === 'review'} onClose={close} title={t.reviewTitle}>
        <div className="dialog">
          <div className="rating-picker" role="radiogroup" aria-label={t.reviewTitle}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                className="rating-picker__star"
                data-on={n <= rating}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            ))}
          </div>
          <StarRating value={rating} />
          <label className="booking__field">
            <span>{t.review}</span>
            <textarea
              rows={3}
              value={comment}
              placeholder={t.reviewPlaceholder}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          {error && <p className="booking__error">{error}</p>}
          <div className="booking__actions">
            <Button variant="secondary" onClick={close} disabled={isPending}>
              {dict.common.cancel}
            </Button>
            <Button onClick={onReview} disabled={isPending}>
              {isPending ? dict.common.loading : t.submitReview}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
