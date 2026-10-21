import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PhasePlaceholder } from '../../shared/phase-placeholder';

/** /catalog — lazy-loaded route; the real screen is ported in Phase 5. */
@Component({
  selector: 'th-catalog-page',
  imports: [PhasePlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<th-phase-placeholder screen="Catalog" [phase]="5" />',
})
export class CatalogPage {}
