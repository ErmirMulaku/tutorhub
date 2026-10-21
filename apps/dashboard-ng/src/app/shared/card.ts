import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Port of @ermulaku/ui's `<Card>`: a styled box whose content is projected in. */
@Component({
  selector: 'th-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'th-card' },
  // Block display comes from styles/_hosts.scss (an element selector, so classes win).
  template: '<ng-content />',
})
export class Card {}
