import { type JSX, useState } from 'react';
import { Avatar, Button, Card, StarRating } from '@ermulaku/ui';
import {
  type TutorReview,
  useGetMyReviewsQuery,
  useGetReviewSummaryQuery,
  useReplyToReviewMutation,
} from '../../store/api';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { useToast } from '../../components/ToastProvider';
import { dayOf } from '../../lib/format';

type Filter = 'all' | 'unreplied' | 'replied';

function ReviewCard({ review }: { review: TutorReview }): JSX.Element {
  const [reply] = useReplyToReviewMutation();
  const [draft, setDraft] = useState('');
  const toast = useToast();
  return (
    <Card className="review">
      <div className="review__head">
        <Avatar name={review.studentName} size="md" />
        <div className="review__who">
          <div className="review__name">{review.studentName}</div>
          <div className="muted">
            {review.subjectName} · {dayOf(review.createdAt)}
          </div>
        </div>
        <StarRating value={review.rating} />
      </div>
      {review.comment && <p className="review__body">{review.comment}</p>}
      {review.reply ? (
        <div className="review__reply">
          <div className="review__reply-label">You replied</div>
          {review.reply}
        </div>
      ) : (
        <div className="review__reply-form">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply…"
          />
          <Button
            size="sm"
            disabled={draft.trim() === ''}
            onClick={() => {
              void reply({ id: review.id, reply: draft.trim() })
                .unwrap()
                .then(() => toast('Reply posted'));
            }}
          >
            Reply
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ReviewsScreen(): JSX.Element {
  const [filter, setFilter] = useState<Filter>('all');
  const { data: summary } = useGetReviewSummaryQuery();
  const { data: reviews } = useGetMyReviewsQuery(filter);
  const maxDist = summary ? Math.max(1, ...summary.distribution) : 1;

  return (
    <div className="reviews">
      {summary && (
        <Card className="rev-summary">
          <div className="rev-summary__score">
            <div className="rev-summary__avg">{summary.average.toFixed(1)}</div>
            <StarRating value={summary.average} />
            <div className="muted">{summary.count} reviews</div>
          </div>
          <div className="rev-summary__dist">
            {summary.distribution.map((count, i) => (
              <div key={i} className="rev-summary__row">
                <span className="rev-summary__star">{5 - i}★</span>
                <div className="rev-summary__bar-track">
                  <div
                    className="rev-summary__bar-fill"
                    style={{ width: `${String(Math.round((count / maxDist) * 100))}%` }}
                  />
                </div>
                <span className="muted rev-summary__count">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SegmentedTabs<Filter>
        segments={[
          { key: 'all', label: 'All' },
          { key: 'unreplied', label: 'Needs reply' },
          { key: 'replied', label: 'Replied' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <div className="reviews__list">
        {reviews?.length === 0 && <p className="muted">No reviews in this view.</p>}
        {reviews?.map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>
    </div>
  );
}
