import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Port of components/ToggleSwitch.tsx — an iOS-style switch (GPU-only knob slide).
 *
 * Two ways to use it:
 * - stand-alone, two-way bound: `<th-toggle-switch [(checked)]="on" />` (a `model()`);
 * - inside a Reactive Form: `<th-toggle-switch formControlName="enabled" />`.
 *
 * The second works because it implements `ControlValueAccessor` — the
 * interface the forms API uses to read and write a custom control, the same
 * way it talks to a native <input>.
 */
@Component({
  selector: 'th-toggle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ToggleSwitch), multi: true },
  ],
  template: `
    <button
      type="button"
      role="switch"
      class="toggle"
      [class.toggle--on]="checked()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="toggle()"
      (blur)="onTouched()"
    >
      <span class="toggle__knob"></span>
    </button>
  `,
})
export class ToggleSwitch implements ControlValueAccessor {
  readonly checked = model(false);
  readonly label = input<string>();
  protected readonly disabled = signal(false);

  private onChange: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected toggle(): void {
    const next = !this.checked();
    this.checked.set(next);
    this.onChange(next);
    this.onTouched();
  }

  // --- ControlValueAccessor: how a FormControl drives this component -------
  writeValue(value: unknown): void {
    this.checked.set(value === true);
  }
  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
