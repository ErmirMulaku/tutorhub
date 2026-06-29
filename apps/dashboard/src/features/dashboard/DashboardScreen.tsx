import { type JSX, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Card, Skeleton, StarRating } from '@ermulaku/ui';
import {
  type TutorBooking,
  useGetDashboardSummaryQuery,
  useGetMeTutorQuery,
  useGetMyReviewsQuery,
  useGetTodayScheduleQuery,
} from '../../store/api';
import { BellIcon, CalendarIcon, DollarIcon, StarIcon } from '../../components/icons';
import { KPIStat } from '../../components/KPIStat';
import { StatusPill } from '../../components/StatusPill';
import { money, timeOf } from '../../lib/format';

const BANNER_KEY = 'th_setup_dismissed';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function ScheduleRow({ booking }: { booking: TutorBooking }): JSX.Element {
  return (
    <div className="sched-row">
      <div className="sched-row__time">
        <span>{timeOf(booking.startTime)}</span>
        <span className="muted">{timeOf(booking.endTime)}</span>
      </div>
      <span className={`sched-row__spine sched-row__spine--${booking.subject.name.toLowerCase()}`} />
      <Avatar name={booking.student.fullName} size="sm" />
      <div className="sched-row__info">
        <div className="sched-row__title">
          {booking.subject.name} · {booking.subject.level.toLowerCase()}
        </div>
        <div className="muted">with {booking.student.fullName} · Online</div>
      </div>
      <StatusPill status={booking.status} />
    </div>
  );
}

export function DashboardScreen(): JSX.Element {
  const { data: me } = useGetMeTutorQuery();
  const { data: summary, isLoading } = useGetDashboardSummaryQuery();
  const { data: today } = useGetTodayScheduleQuery();
  const { data: reviews } = useGetMyReviewsQuery('all');

  const upNext = today?.find((b) => b.status === 'CONFIRMED');
  const firstName = me?.name?.split(' ')[0] ?? 'there';
  const latestReview = reviews?.[0];

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(BANNER_KEY) === '1';
    } catch {
      return false;
    }
  });
  function dismissBanner(): void {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem(BANNER_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="dash">
      {!bannerDismissed && (
        <div className="setup-banner">
          <div className="setup-banner__text">
            <strong>Finish setting up your tutor profile</strong>
            <span>Add your subjects, hours and payout details to start getting booked.</span>
          </div>
          <div className="setup-banner__actions">
            <Link to="/onboarding">
              <Button size="sm">Continue setup</Button>
            </Link>
            <button
              type="button"
              className="setup-banner__close"
              aria-label="Dismiss"
              onClick={dismissBanner}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="dash__greeting">
        <h2>
          {greeting()}, {firstName} 👋
        </h2>
        <p className="muted">Here's how your practice is doing today.</p>
      </div>

      <div className="kpi-row">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={120} />)
        ) : (
          <>
            <KPIStat
              icon={<CalendarIcon />}
              label="Lessons today"
              value={String(summary.lessonsToday)}
            />
            <KPIStat
              icon={<DollarIcon />}
              label="Earnings this week"
              value={money(summary.earningsWeekCents)}
            />
            <KPIStat
              icon={<StarIcon />}
              label="Average rating"
              value={summary.avgRating ? summary.avgRating.toFixed(1) : '—'}
              delta={
                summary.reviewCount > 0
                  ? { text: `${String(summary.reviewCount)} reviews`, tone: 'neutral' }
                  : undefined
              }
            />
            <KPIStat
              icon={<BellIcon />}
              label="Pending requests"
              value={String(summary.pendingCount)}
              delta={
                summary.pendingCount > 0 ? { text: 'Action needed', tone: 'danger' } : undefined
              }
            />
          </>
        )}
      </div>

      <div className="dash__cols">
        <Card>
          <div className="card-head">
            <h3>Today's schedule</h3>
            <Link to="/calendar" className="card-head__link">
              Open calendar →
            </Link>
          </div>
          {today && today.length > 0 ? (
            <div className="sched-list">
              {today.map((b) => (
                <ScheduleRow key={b.id} booking={b} />
              ))}
            </div>
          ) : (
            <p className="muted">No lessons scheduled today.</p>
          )}
        </Card>

        <div className="dash__rail">
          <Card className="upnext">
            <div className="upnext__eyebrow">Up next</div>
            {upNext ? (
              <>
                <div className="upnext__title">
                  {upNext.subject.name} · {upNext.subject.level.toLowerCase()}
                </div>
                <div className="upnext__meta">
                  with {upNext.student.fullName} · {timeOf(upNext.startTime)}
                </div>
                <Button size="sm">Join lesson</Button>
              </>
            ) : (
              <div className="upnext__meta">Nothing more booked today.</div>
            )}
          </Card>

          <Card>
            <h3 className="card-head__title">Quick actions</h3>
            <div className="quick-grid">
              <Link to="/availability" className="quick-action">
                Edit availability
              </Link>
              <Link to="/catalog" className="quick-action">
                Add a subject
              </Link>
              <Link to="/marketing" className="quick-action">
                Run a promo
              </Link>
              <Link to="/earnings" className="quick-action">
                Withdraw earnings
              </Link>
            </div>
          </Card>

          {latestReview && (
            <Card>
              <div className="card-head">
                <h3 className="card-head__title" style={{ margin: 0 }}>
                  Latest review
                </h3>
                <Link to="/reviews" className="card-head__link">
                  All reviews →
                </Link>
              </div>
              <StarRating value={latestReview.rating} />
              {latestReview.comment && (
                <p className="latest-review__quote">“{latestReview.comment}”</p>
              )}
              <div className="latest-review__by">
                {latestReview.studentName} · {latestReview.subjectName}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
