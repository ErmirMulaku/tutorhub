import { type JSX, useEffect, useRef, useState } from 'react';
import { useGetTutorNotificationsQuery } from '../store/api';
import { BellIcon } from './icons';

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const DOT: Record<string, string> = {
  booking: 'notif__dot--warn',
  message: 'notif__dot--primary',
  review: 'notif__dot--star',
};

export function NotificationsBell(): JSX.Element {
  const { data: notifications } = useGetTutorNotificationsQuery();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = notifications?.length ?? 0;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="topbar__icon-btn topbar__bell"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {count > 0 && <span className="topbar__bell-dot" />}
      </button>
      {open && (
        <div className="notif__panel th-fade-up">
          <div className="notif__head">Notifications</div>
          {count === 0 ? (
            <div className="notif__empty muted">You're all caught up.</div>
          ) : (
            notifications?.map((n) => (
              <div key={n.id} className="notif__item">
                <span className={`notif__dot ${DOT[n.type] ?? 'notif__dot--primary'}`} />
                <div className="notif__body">
                  <div className="notif__title">{n.title}</div>
                  {n.detail && <div className="muted notif__detail">{n.detail}</div>}
                </div>
                <span className="muted notif__time">{ago(n.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
