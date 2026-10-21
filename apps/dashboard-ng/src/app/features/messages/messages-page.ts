import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /messages — lazy-loaded route; the real screen is ported in Phase 4. */
@Component({
  selector: 'th-messages-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Messages" [phase]="4" />',
})
export class MessagesPage {}
