import type { JSX } from 'react';

export interface Segment<T extends string> {
  key: T;
  label: string;
  badge?: number;
}

interface SegmentedTabsProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
}

/** White-on-track segmented control (Lessons / Reviews filters, Settings tabs). */
export function SegmentedTabs<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedTabsProps<T>): JSX.Element {
  return (
    <div className="segtabs" role="tablist">
      {segments.map((s) => (
        <button
          key={s.key}
          type="button"
          role="tab"
          aria-selected={value === s.key}
          className={`segtabs__tab${value === s.key ? ' segtabs__tab--active' : ''}`}
          onClick={() => onChange(s.key)}
        >
          {s.label}
          {s.badge !== undefined && s.badge > 0 && (
            <span className="segtabs__badge">{s.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
