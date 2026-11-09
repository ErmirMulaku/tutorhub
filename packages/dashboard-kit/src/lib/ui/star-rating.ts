import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Port of @ermulaku/ui's `<StarRating>`: five stars filled to `value` (0–5). */
@Component({
  selector: 'th-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'th-rating',
    role: 'img',
    '[attr.aria-label]': '"Rated " + safe().toFixed(1) + " out of 5"',
  },
  template: `
    <span class="th-rating__stars" aria-hidden="true">
      <span class="th-rating__fill" [style.inline-size.%]="(safe() / 5) * 100"></span>
    </span>
  `,
})
export class StarRating {
  readonly value = input.required<number>();
  protected readonly safe = computed(() => Math.max(0, Math.min(5, this.value())));
}
