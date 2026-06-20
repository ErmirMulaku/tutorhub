import { cx } from './cx.js';

export interface StarRatingProps {
  /** Rating in the range 0–5; fractional values render a partial star. */
  value: number;
  /** Show the numeric value next to the stars. */
  showValue?: boolean;
  /** Optional review count, rendered as `(N)` after the value. */
  count?: number | undefined;
  className?: string | undefined;
}

const clamp = (n: number): number => Math.max(0, Math.min(5, n));

/**
 * Read-only star rating. The bright stars are clipped to a percentage width
 * over a muted track, so partial ratings (e.g. 4.3) render exactly — and it
 * mirrors under RTL because the fill is pinned with `inset-inline-start`.
 */
export function StarRating({
  value,
  showValue = false,
  count,
  className,
}: StarRatingProps): React.JSX.Element {
  const safe = clamp(value);
  const pct = `${(safe / 5) * 100}%`;
  return (
    <span
      className={cx('th-rating', className)}
      role="img"
      aria-label={`Rated ${safe.toFixed(1)} out of 5`}
    >
      <span className="th-rating__stars" aria-hidden="true">
        <span className="th-rating__fill" style={{ inlineSize: pct }} />
      </span>
      {showValue && (
        <span className="th-rating__value">
          {safe.toFixed(1)}
          {typeof count === 'number' ? ` (${count})` : ''}
        </span>
      )}
    </span>
  );
}
