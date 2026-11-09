import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from './button';

/**
 * Inline "this failed to load" message with a Retry button. The React app
 * left failed queries as an endless skeleton or an empty list; this makes the
 * failure visible and recoverable without a page reload.
 */
@Component({
  selector: 'th-error-state',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', class: 'error-state' },
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
  `,
  template: `
    <p class="error">{{ message() }}</p>
    <button th-button size="sm" variant="secondary" (click)="retry.emit()">Retry</button>
  `,
})
export class ErrorState {
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
