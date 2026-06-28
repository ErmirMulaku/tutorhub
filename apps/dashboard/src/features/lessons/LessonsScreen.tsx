import { type JSX, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Button, Card, Skeleton } from '@ermulaku/ui';
import {
  type TutorBooking,
  useAcceptBookingMutation,
  useCompleteBookingMutation,
  useDeclineBookingMutation,
  useGetTutorBookingsQuery,
} from '../../store/api';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/ToastProvider';
import { dayOf, timeOf } from '../../lib/format';

type Tab = 'upcoming' | 'pending' | 'past';

function inTab(b: TutorBooking, tab: Tab): boolean {
  if (tab === 'pending') return b.status === 'PENDING';
  if (tab === 'upcoming') return b.status === 'CONFIRMED';
  return b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'NO_SHOW';
}

export function LessonsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const initial = (params.get('status') as Tab | null) ?? 'upcoming';
  const [tab, setTab] = useState<Tab>(['upcoming', 'pending', 'past'].includes(initial) ? initial : 'upcoming');
  const { data: bookings, isLoading } = useGetTutorBookingsQuery();
  const [accept] = useAcceptBookingMutation();
  const [decline] = useDeclineBookingMutation();
  const [complete] = useCompleteBookingMutation();
  const toast = useToast();

  const pendingCount = bookings?.filter((b) => b.status === 'PENDING').length ?? 0;
  const rows = (bookings ?? []).filter((b) => inTab(b, tab));

  function changeTab(next: Tab): void {
    setTab(next);
    setParams(next === 'upcoming' ? {} : { status: next }, { replace: true });
  }

  const onAccept = (b: TutorBooking): void => {
    void accept(b.id)
      .unwrap()
      .then(() => toast(`Accepted ${b.student.fullName}'s lesson`));
  };
  const onDecline = (b: TutorBooking): void => {
    void decline(b.id)
      .unwrap()
      .then(() => toast(`Declined ${b.student.fullName}'s request`));
  };
  const onComplete = (b: TutorBooking): void => {
    void complete(b.id)
      .unwrap()
      .then(() => toast('Lesson marked complete'));
  };

  return (
    <div className="lessons">
      <SegmentedTabs<Tab>
        segments={[
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'pending', label: 'Pending', badge: pendingCount },
          { key: 'past', label: 'Past' },
        ]}
        value={tab}
        onChange={changeTab}
      />

      <Card>
        {isLoading ? (
          <Skeleton height={160} />
        ) : rows.length === 0 ? (
          <p className="muted">No {tab} lessons.</p>
        ) : (
          <div className="lesson-list">
            {rows.map((b) => (
              <div key={b.id} className="lesson-row">
                <Avatar name={b.student.fullName} size="md" />
                <div className="lesson-row__who">
                  <div className="lesson-row__name">{b.student.fullName}</div>
                  <div className="muted">
                    {b.subject.name} · {b.subject.level.toLowerCase()}
                  </div>
                </div>
                <div className="lesson-row__when">
                  <div>{dayOf(b.startTime)}</div>
                  <div className="muted">
                    {timeOf(b.startTime)} · 60 min
                  </div>
                </div>
                <StatusPill status={b.status} />
                <div className="lesson-row__actions">
                  {b.status === 'PENDING' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => onDecline(b)}>
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => onAccept(b)}>
                        Accept
                      </Button>
                    </>
                  )}
                  {b.status === 'CONFIRMED' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => toast('Opening chat…')}>
                        Message
                      </Button>
                      <Button size="sm" onClick={() => onComplete(b)}>
                        Mark complete
                      </Button>
                    </>
                  )}
                  {tab === 'past' && (
                    <Button size="sm" variant="secondary" onClick={() => toast('Rebooking…')}>
                      Rebook
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
