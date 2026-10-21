import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /reviews — lazy-loaded route; the real screen is ported in Phase 6. */
@Component({
  selector: 'th-reviews-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Reviews" [phase]="6" />',
})
export class ReviewsPage {}
