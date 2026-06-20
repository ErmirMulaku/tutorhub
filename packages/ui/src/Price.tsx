import { cx } from './cx.js';

export interface PriceProps {
  /** Amount in minor units (cents), matching the API's `hourlyCents`. */
  cents: number;
  /** ISO 4217 currency code. */
  currency?: string;
  /** BCP-47 locale for number formatting (e.g. `en`, `ar`). */
  locale?: string;
  /** Suffix such as `/hr`, rendered muted. */
  unit?: string | undefined;
  className?: string | undefined;
}

/** Locale-aware money formatting via `Intl.NumberFormat` (no date/money lib). */
export function Price({
  cents,
  currency = 'USD',
  locale,
  unit,
  className,
}: PriceProps): React.JSX.Element {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return (
    <span className={cx('th-price', className)}>
      {formatted}
      {unit ? <span className="th-price__unit">{unit}</span> : null}
    </span>
  );
}
