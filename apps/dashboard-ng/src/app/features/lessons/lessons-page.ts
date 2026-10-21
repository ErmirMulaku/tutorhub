import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /lessons — lazy-loaded route; the real screen is ported in Phase 3. */
@Component({
  selector: 'th-lessons-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Lessons" [phase]="3" />',
})
export class LessonsPage {}
