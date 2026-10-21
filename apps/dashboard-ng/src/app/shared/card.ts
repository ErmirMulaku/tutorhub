import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Port of @ermulaku/ui's `<Card>`: a styled box whose content is projected in. */
@Component({
  selector: 'th-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'th-card' },
  // Custom elements are inline by default; a card is a block like React's <div>.
  styles: ':host { display: block; }',
  template: '<ng-content />',
})
export class Card {}
