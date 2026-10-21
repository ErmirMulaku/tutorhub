import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /settings — lazy-loaded route; the real screen is ported in Phase 5. */
@Component({
  selector: 'th-settings-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Settings" [phase]="5" />',
})
export class SettingsPage {}
