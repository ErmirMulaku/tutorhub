import type { JSX } from 'react';

interface AreaChartProps {
  points: { label: string; value: number }[];
}

/** Inline SVG area + line chart (teal line, gradient fill). */
export function AreaChart({ points }: AreaChartProps): JSX.Element {
  const W = 640;
  const H = 200;
  const pad = 24;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = H - pad - (p.value / max) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = xy.map(([x, y]) => `${String(x)},${String(y)}`).join(' ');
  const area = `${String(pad)},${String(H - pad)} ${line} ${String(pad + (points.length - 1) * stepX)},${String(H - pad)}`;

  return (
    <svg className="areachart" viewBox={`0 0 ${String(W)} ${String(H)}`} preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#areaFill)" />
      <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--primary)" />
      ))}
      {points.map((p, i) => (
        <text
          key={i}
          x={pad + i * stepX}
          y={H - 6}
          textAnchor="middle"
          fontSize="11"
          fill="var(--faint)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
