'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { interpolate, type Dictionary } from '@/i18n/dictionaries';
import { markAllNotificationsReadAction } from '@/lib/actions';
import { relativeTime } from '@/lib/datetime';
import type { Notification, NotificationType } from '@/lib/queries';

interface NotificationsMenuProps {
  locale: Locale;
  dict: Dictionary;
  items: Notification[];
  unread: number;
}

/** Localised title/body for a notification, rendered from its type + params. */
function content(
  n: Notification,
  t: Dictionary['notif'],
): { title: string; body: string } {
  const tutor = n.actorName ?? '';
  const subject = n.detail ?? '';
  switch (n.type) {
    case 'BOOKING_CONFIRMED':
      return { title: t.bookingConfirmedTitle, body: interpolate(t.bookingConfirmedBody, { subject, tutor }) };
    case 'LESSON_REMINDER':
      return { title: t.lessonReminderTitle, body: interpolate(t.lessonReminderBody, { subject, tutor }) };
    case 'REVIEW_PROMPT':
      return { title: t.reviewPromptTitle, body: interpolate(t.reviewPromptBody, { subject, tutor }) };
    case 'GIFT_RECEIVED':
      return { title: t.giftReceivedTitle, body: interpolate(t.giftReceivedBody, { detail: n.detail ?? '', tutor }) };
  }
}

function NotifIcon({ type }: { type: NotificationType }): React.JSX.Element {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (type) {
    case 'BOOKING_CONFIRMED':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
        </svg>
      );
    case 'LESSON_REMINDER':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'REVIEW_PROMPT':
      return (
        <svg {...common}>
          <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
        </svg>
      );
    case 'GIFT_RECEIVED':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="13" rx="1" />
          <path d="M3 12h18M12 8v13M12 8S10 3 7.5 4.5 9.5 8 12 8zM12 8s2-5 4.5-3.5S14.5 8 12 8z" />
        </svg>
      );
  }
}

/** Header bell + dropdown feed of the student's notifications. */
export function NotificationsMenu({
  locale,
  dict,
  items,
  unread,
}: NotificationsMenuProps): React.JSX.Element {
  const router = useRouter();
  const t = dict.notif;
  const [open, setOpen] = useState(false);
  const [localUnread, setLocalUnread] = useState(unread);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setLocalUnread(unread), [unread]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markAll = (): void => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setLocalUnread(0);
      router.refresh();
    });
  };

  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="notif__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {localUnread > 0 && <span className="notif__badge">{localUnread}</span>}
      </button>

      {open && (
        <div className="notif__panel th-fade-up" role="menu">
          <div className="notif__head">
            <span className="notif__title">{t.title}</span>
            {localUnread > 0 && (
              <button type="button" className="notif__markall" onClick={markAll} disabled={isPending}>
                {t.markAll}
              </button>
            )}
          </div>
          {items.length > 0 ? (
            <ul className="notif__list">
              {items.map((n) => {
                const { title, body } = content(n, t);
                return (
                  <li key={n.id} className="notif__row" data-unread={!n.read}>
                    <span className="notif__icon" aria-hidden="true">
                      <NotifIcon type={n.type} />
                    </span>
                    <div className="notif__body">
                      <p className="notif__row-title">
                        {!n.read && <span className="notif__dot" aria-hidden="true" />}
                        {title}
                      </p>
                      <p className="notif__row-text">{body}</p>
                      <time className="notif__time">{relativeTime(n.createdAt, locale)}</time>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="notif__empty">{t.empty}</p>
          )}
          <button
            type="button"
            className="notif__viewall"
            onClick={() => {
              setOpen(false);
              router.push(`/${locale}/lessons`);
            }}
          >
            {t.viewAll}
          </button>
        </div>
      )}
    </div>
  );
}
