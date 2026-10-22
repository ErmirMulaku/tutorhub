import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from './icon';

export interface KpiDelta {
  text: string;
  tone: 'success' | 'danger' | 'neutral';
}

/**
 * A KPI card's height in px: 2 × (1 border + 24 padding) + 38 (icon row)
 * + 14 + 34 (value) + 17 (label). The line boxes are fixed in
 * styles/_overrides.scss, so this holds in any font; the dashboard's loading
 * skeletons use it, and kpi-stat.spec.ts fails if the card's CSS drifts.
 */
export const KPI_CARD_HEIGHT = 153;

/**
 * Port of components/KPIStat.tsx. React passed the icon as a ReactNode; here
 * it's an icon *name* — Angular can't pass rendered markup through an input
 * (it would use content projection for that), and a name is all we need.
 */
@Component({
  selector: 'th-kpi-stat',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The host is the card itself (React: <Card className="kpi">).
  host: { class: 'th-card kpi' },
  template: `
    <div class="kpi__top">
      <span class="kpi__icon"><svg [th-icon]="icon()"></svg></span>
      @if (delta(); as d) {
        <span class="kpi__delta kpi__delta--{{ d.tone }}">{{ d.text }}</span>
      }
    </div>
    <div class="kpi__value">{{ value() }}</div>
    <div class="kpi__label">{{ label() }}</div>
  `,
})
export class KpiStat {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<KpiDelta | undefined>(undefined);
}
