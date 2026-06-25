'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Modal, Price, StarRating } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { cancelBookingAction, leaveReviewAction, rescheduleBookingAction } from '@/lib/actions';
import { formatDayTab, formatFullDateTime, formatSlotTime } from '@/lib/datetime';
import type { MyBooking, Slot } from '@/lib/queries';

interface LessonDetailViewProps {
  booking: MyBooking;
  dates: string[];
  slotsByDate: Record<string, Slot[]>;
  locale: Locale;
  currency: string;
  dict: Dictionary;
}

const UPCOMING = new Set(['PENDING', 'CONFIRMED']);

const PILL_TONE: Record<MyBooking['status'], string> = {
  PENDING: 'th-pill--warn',
  CONFIRMED: 'th-pill--success',
  COMPLETED: '',
  CANCELLED: 'th-pill--danger',
  NO_SHOW: 'th-pill--danger',
};

/** Lesson detail: summary, join, inline reschedule, cancel, review / book again. */
export function LessonDetailView({
  booking,
  dates,
  slotsByDate,
  locale,
  currency,
  dict,
}: LessonDetailViewProps): React.JSX.Element {
  const t = dict.lessons;
  const router = useRouter();
  const tz = booking.tutor.timezone;

  const [rescheduling, setRescheduling] = useState(false);
  const [day, setDay] = useState(dates[0] as string);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [dialog, setDialog] = useState<'cancel' | 'review' | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isUpcoming = UPCOMING.has(booking.status);
  const slots = slotsByDate[day] ?? [];

  const confirmReschedule = (): void => {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const res = await rescheduleBookingAction(booking.id, slot.start);
      if (res.ok) {
        setRescheduling(false);
        setSlot(null);
        router.refresh();
      } else setError(res.error ?? t.rescheduleTitle);
    });
  };

  const confirmCancel = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingAction(booking.id);
      if (res.ok) {
        setDialog(null);
        router.refresh();
      } else setError(res.error ?? t.cancelTitle);
    });
  };

  const submitReview = (): void => {
    setError(null);
    startTransition(async () => {
      const res = await leaveReviewAction(booking.id, rating, comment || null);
      if (res.ok) {
        setDialog(null);
        router.refresh();
      } else setError(res.error ?? t.reviewTitle);
    });
  };

  return (
    <>
      <div className="ld-card">
        <div className="ld-card__head">
          <Avatar name={booking.tutor.name} size="lg" />
          <div className="ld-card__head-main">
            <div className="ld-card__title-row">
              <h1 className="ld-card__subject">{booking.subject.name}</h1>
              <span className={`th-pill ${PILL_TONE[booking.status]}`}>
                {t[`status${booking.status}` as keyof typeof t]}
              </span>
            </div>
            <p className="ld-card__with">{interpolate(t.with, { tutor: booking.tutor.name })}</p>
          </div>
          <div className="ld-card__price">
            <Price cents={booking.tutor.hourlyCents} currency={currency} locale={locale} />
          </div>
        </div>

        <dl className="ld-grid">
          <div>
            <dt>{t.dateTime}</dt>
            <dd>{formatFullDateTime(booking.startTime, tz, locale)}</dd>
          </div>
          <div>
            <dt>{t.format}</dt>
            <dd>{t.online}</dd>
          </div>
        </dl>

        {isUpcoming && (
          <div className="ld-actions">
            <Button block size="lg">
              {t.join}
            </Button>
            <p className="ld-actions__note">{t.joinNote}</p>
            <div className="ld-actions__row">
              <Button
                variant="secondary"
                onClick={() => setRescheduling((v) => !v)}
                disabled={isPending}
              >
                {t.reschedule}
              </Button>
              <Button variant="ghost" onClick={() => setDialog('cancel')} disabled={isPending}>
                {t.cancel}
              </Button>
            </div>
          </div>
        )}

        {booking.status === 'COMPLETED' && (
          <div className="ld-actions ld-actions__row">
            <Button onClick={() => setDialog('review')}>{t.review}</Button>
            <Link href={`/${locale}/tutor/${booking.tutor.id}`}>
              <Button variant="secondary">{t.bookAgain}</Button>
            </Link>
          </div>
        )}
      </div>

      {rescheduling && (
        <div className="ld-resched th-fade-up">
          <h2 className="ld-resched__title">{t.pickTime}</h2>
          <div className="day-strip" role="tablist">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === day}
                className="day-strip__day"
                data-active={d === day}
                onClick={() => {
                  setDay(d);
                  setSlot(null);
                }}
              >
                {formatDayTab(d, locale)}
              </button>
            ))}
          </div>
          {slots.length > 0 ? (
            <div className="slot-grid">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  className="slot-grid__slot"
                  data-active={slot?.start === s.start}
                  onClick={() => setSlot(s)}
                >
                  {formatSlotTime(s.start, tz, locale)}
                </button>
              ))}
            </div>
          ) : (
            <p className="profile__muted">{t.noSlots}</p>
          )}
          {error && <p className="booking__error">{error}</p>}
          <div className="booking__actions">
            <Button variant="secondary" onClick={() => setRescheduling(false)} disabled={isPending}>
              {t.keep}
            </Button>
            <Button onClick={confirmReschedule} disabled={isPending || !slot}>
              {isPending ? dict.common.loading : t.confirmReschedule}
            </Button>
          </div>
        </div>
      )}

      <Modal open={dialog === 'cancel'} onClose={() => setDialog(null)} title={t.cancelTitle}>
        <div className="dialog">
          <p>{t.cancelBody}</p>
          {error && <p className="booking__error">{error}</p>}
          <div className="booking__actions">
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={isPending}>
              {t.keep}
            </Button>
            <Button onClick={confirmCancel} disabled={isPending}>
              {isPending ? dict.common.loading : t.confirmCancel}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'review'} onClose={() => setDialog(null)} title={t.reviewTitle}>
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
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={isPending}>
              {dict.common.cancel}
            </Button>
            <Button onClick={submitReview} disabled={isPending}>
              {isPending ? dict.common.loading : t.submitReview}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
