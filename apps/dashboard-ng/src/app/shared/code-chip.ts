import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ToastService } from './toast';

/** Port of components/CodeChip.tsx — a dashed promo-code chip that copies on click. */
@Component({
  selector: 'th-code-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="codechip" title="Copy code" (click)="copy()">
      <span class="codechip__code">{{ code() }}</span>
      <span class="codechip__icon" aria-hidden="true">⧉</span>
    </button>
  `,
})
export class CodeChip {
  private readonly toast = inject(ToastService);
  readonly code = input.required<string>();

  protected copy(): void {
    const code = this.code();
    // The Clipboard API needs a secure context (https or localhost); only claim
    // success when the write actually happened — React toasted regardless.
    // Calling it inside `then` turns a missing `navigator.clipboard` (insecure
    // context) into a rejection instead of a thrown TypeError.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(code))
      .then(
        () => this.toast.show(`Copied ${code}`),
        () => this.toast.show('Could not copy — select the code instead.'),
      );
  }
}
