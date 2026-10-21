import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from './card';

/** Temporary body for a lazy route whose screen hasn't been ported yet. */
@Component({
  selector: 'th-phase-placeholder',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <th-card>
      <h3 class="card-head__title">{{ screen() }}</h3>
      <p class="muted">This screen is ported in Phase {{ phase() }} of the Angular migration.</p>
    </th-card>
  `,
})
export class PhasePlaceholder {
  readonly screen = input.required<string>();
  readonly phase = input.required<number>();
}
