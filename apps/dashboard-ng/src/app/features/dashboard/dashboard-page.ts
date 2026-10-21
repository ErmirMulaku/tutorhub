import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /dashboard — lazy-loaded route; the real screen is ported in Phase 3. */
@Component({
  selector: 'th-dashboard-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Dashboard" [phase]="3" />',
})
export class DashboardPage {}
