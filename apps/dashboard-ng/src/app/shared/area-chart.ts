import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface AreaPoint {
  label: string;
  value: number;
}

const W = 640;
const H = 200;
const PAD = 24;
let nextId = 0;

/**
 * Port of components/AreaChart.tsx — an inline SVG area + line chart.
 *
 * The host *is* the <svg>, so children use the `svg:` namespace prefix. One
 * fix over React: the gradient id was a fixed "areaFill", so two charts on a
 * page would share one gradient; each instance now gets its own id.
 */
@Component({
  selector: 'svg[th-area-chart]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'areachart',
    viewBox: '0 0 640 200',
    preserveAspectRatio: 'none',
    role: 'img',
    '[attr.aria-label]': 'summary()',
  },
  template: `
    <svg:defs>
      <svg:linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
        <svg:stop offset="0%" stop-color="var(--primary)" stop-opacity="0.28" />
        <svg:stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
      </svg:linearGradient>
    </svg:defs>
    <svg:polygon [attr.points]="geometry().area" [attr.fill]="'url(#' + gradientId + ')'" />
    <svg:polyline
      [attr.points]="geometry().line"
      fill="none"
      stroke="var(--primary)"
      stroke-width="2.5"
      stroke-linejoin="round"
    />
    @for (p of geometry().points; track $index) {
      <svg:circle [attr.cx]="p.x" [attr.cy]="p.y" r="3" fill="var(--primary)" />
      <svg:text
        [attr.x]="p.x"
        [attr.y]="labelY"
        text-anchor="middle"
        font-size="11"
        fill="var(--faint)"
      >
        {{ p.label }}
      </svg:text>
    }
  `,
})
export class AreaChart {
  readonly points = input.required<readonly AreaPoint[]>();

  protected readonly gradientId = `areaFill-${String(nextId++)}`;
  protected readonly labelY = H - 6;

  protected readonly geometry = computed(() => {
    const pts = this.points();
    const max = Math.max(1, ...pts.map((p) => p.value));
    const stepX = pts.length > 1 ? (W - PAD * 2) / (pts.length - 1) : 0;
    const points = pts.map((p, i) => ({
      label: p.label,
      x: PAD + i * stepX,
      y: H - PAD - (p.value / max) * (H - PAD * 2),
    }));
    const line = points.map((p) => `${String(p.x)},${String(p.y)}`).join(' ');
    const lastX = PAD + (pts.length - 1) * stepX;
    const area = `${String(PAD)},${String(H - PAD)} ${line} ${String(lastX)},${String(H - PAD)}`;
    return { points, line, area };
  });

  protected readonly summary = computed(() =>
    this.points()
      .map((p) => `${p.label}: ${String(p.value)}`)
      .join(', '),
  );
}
