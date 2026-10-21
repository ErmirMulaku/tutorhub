import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /availability — lazy-loaded route; the real screen is ported in Phase 5. */
@Component({
  selector: 'th-availability-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Availability" [phase]="5" />',
})
export class AvailabilityPage {}
