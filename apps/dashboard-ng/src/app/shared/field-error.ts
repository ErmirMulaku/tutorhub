import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';

/** Human messages for the validators this app uses. */
function describe(errors: ValidationErrors): string {
  if (errors['required']) return 'This field is required.';
  const min = errors['min'] as { min: number } | undefined;
  if (min) return `Must be at least ${String(min.min)}.`;
  const max = errors['max'] as { max: number } | undefined;
  if (max) return `Must be at most ${String(max.max)}.`;
  if (errors['endBeforeStart']) return 'The end must be after the start.';
  if (errors['timezone']) return 'Use an IANA timezone, e.g. Europe/Berlin.';
  if (errors['email']) return 'Enter a valid email address.';
  return 'This value is not valid.';
}

/**
 * Shows a control's (or group's) first validation error once the user has
 * touched it — e.g. `<th-field-error [control]="form.controls.price" />`.
 *
 * Reactive-form state isn't a signal, so an OnPush component wouldn't notice a
 * blur or a new value by itself. `control.events` (one stream for value,
 * status, touched and pristine changes) is turned into a signal; reading it
 * inside `message` makes the component re-render whenever the control changes.
 */
@Component({
  selector: 'th-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // New UI (React showed no inline errors), so it gets its own scoped style
  // instead of a class in the ported global stylesheet.
  styles: '.field-error { font-size: 12px; font-weight: 600; }',
  template: `
    @if (message(); as text) {
      <small class="error field-error" role="alert">{{ text }}</small>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();

  private readonly changes = toSignal(
    toObservable(this.control).pipe(switchMap((c) => c.events.pipe(startWith(null)))),
  );

  protected readonly message = computed(() => {
    this.changes();
    const c = this.control();
    if (!c.invalid || !c.touched || c.errors === null) return null;
    return describe(c.errors);
  });
}
