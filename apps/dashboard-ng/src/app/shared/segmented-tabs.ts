import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface Segment<T extends string> {
  key: T;
  label: string;
  badge?: number;
}

/**
 * Port of components/SegmentedTabs.tsx. A *generic* component: with
 * `strictTemplates`, Angular infers `T` from the `segments` binding, so
 * `(changed)` hands back the same string-literal union (e.g. 'upcoming' |
 * 'pending' | 'past'), like `<SegmentedTabs<Tab>>` did in React.
 */
@Component({
  selector: 'th-segmented-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segtabs" role="tablist">
      @for (s of segments(); track s.key) {
        <button
          type="button"
          role="tab"
          class="segtabs__tab"
          [class.segtabs__tab--active]="value() === s.key"
          [attr.aria-selected]="value() === s.key"
          (click)="changed.emit(s.key)"
        >
          {{ s.label }}
          @if (s.badge !== undefined && s.badge > 0) {
            <span class="segtabs__badge">{{ s.badge }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class SegmentedTabs<T extends string> {
  readonly segments = input.required<Segment<T>[]>();
  readonly value = input.required<T>();
  readonly changed = output<T>();
}
