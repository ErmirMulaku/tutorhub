import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /marketing — lazy-loaded route; the real screen is ported in Phase 6. */
@Component({
  selector: 'th-marketing-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Marketing" [phase]="6" />',
})
export class MarketingPage {}
