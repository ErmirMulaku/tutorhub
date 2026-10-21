import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /earnings — lazy-loaded route; the real screen is ported in Phase 6. */
@Component({
  selector: 'th-earnings-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Earnings" [phase]="6" />',
})
export class EarningsPage {}
