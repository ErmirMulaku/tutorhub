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
export function BarChart({ bars, format }: BarChartProps): JSX.Element {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="barchart">
      {bars.map((b, i) => (
        <div key={i} className="barchart__col">
          <span className="barchart__value">{format ? format(b.value) : b.value}</span>
          <div
            className={`barchart__bar${b.highlight ? ' barchart__bar--hl' : ''}`}
            style={{ height: `${String(Math.round((b.value / max) * 100))}%` }}
          />
          <span className="barchart__label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
