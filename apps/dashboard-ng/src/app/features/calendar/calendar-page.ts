import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /calendar — lazy-loaded route; the real screen is ported in Phase 5. */
@Component({
  selector: 'th-calendar-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Calendar" [phase]="5" />',
})
export class CalendarPage {}
