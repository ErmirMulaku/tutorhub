import type { JSX } from 'react';

export interface Bar {
  label: string;
  value: number;
  /** Highlight (e.g. current month) uses --primary; others --primary-100. */
  highlight?: boolean;
}

interface BarChartProps {
  bars: Bar[];
  /** Formats the value label above each bar. */
  format?: (value: number) => string;
}

/** Flex-based bar chart (CSS heights from in-memory data). */
export function BarChart({
  bars,
  format = (v) => String(v),
}: BarChartProps): JSX.Element {
  const max = Math.max(
    1,
    ...bars.map((b) => (Number.isFinite(b.value) ? b.value : 0)),
  );
  return (
    <div
      className="barchart"
      role="img"
      aria-label={bars.map((b) => `${b.label}: ${format(b.value)}`).join(', ')}
    >
      {bars.map((b) => (
        <div key={b.label} className="barchart__col">
          <span className="barchart__value">{format(b.value)}</span>
          <div
            className={`barchart__bar${b.highlight ? ' barchart__bar--hl' : ''}`}
            style={{ height: `${Math.round((Math.max(0, b.value) / max) * 100)}%` }}
          />
          <span className="barchart__label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
