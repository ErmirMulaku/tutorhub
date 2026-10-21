import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface Bar {
  label: string;
  value: number;
  /** Highlight (e.g. the current month) uses --primary; others --primary-100. */
  highlight?: boolean;
}

/** Port of components/BarChart.tsx — flex columns sized from the data, no chart library. */
@Component({
  selector: 'th-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'barchart', role: 'img', '[attr.aria-label]': 'summary()' },
  template: `
    @for (b of rows(); track b.label) {
      <div class="barchart__col">
        <span class="barchart__value">{{ b.text }}</span>
        <div
          class="barchart__bar"
          [class.barchart__bar--hl]="b.highlight"
          [style.height.%]="b.heightPct"
        ></div>
        <span class="barchart__label">{{ b.label }}</span>
      </div>
    }
  `,
})
export class BarChart {
  readonly bars = input.required<readonly Bar[]>();
  /** Formats the value shown above each bar (and in the accessible label). */
  readonly format = input<(value: number) => string>((v) => String(v));

  protected readonly rows = computed(() => {
    const bars = this.bars();
    const max = Math.max(1, ...bars.map((b) => (Number.isFinite(b.value) ? b.value : 0)));
    return bars.map((b) => ({
      label: b.label,
      highlight: b.highlight === true,
      text: this.format()(b.value),
      heightPct: Math.round((Math.max(0, b.value) / max) * 100),
    }));
  });

  /** "Jan: $120, Feb: $80, …" — what a screen reader announces for the chart. */
  protected readonly summary = computed(() =>
    this.rows()
      .map((r) => `${r.label}: ${r.text}`)
      .join(', '),
  );
}
