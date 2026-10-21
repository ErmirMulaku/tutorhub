import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Port of @ermulaku/ui's `<Skeleton>`: a shimmering placeholder block. */
@Component({
  selector: 'th-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'th-skeleton',
    'aria-hidden': 'true',
    'data-testid': 'skeleton',
    '[style.inline-size]': 'width()',
    '[style.block-size]': 'height() + "px"',
  },
  template: '',
})
export class Skeleton {
  readonly width = input('100%');
  /** Height in px (the React call sites all pass a number). */
  readonly height = input(16);
}
