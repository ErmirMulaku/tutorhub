import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { filter, finalize } from 'rxjs';
import { errorMessage } from '../../core/api/errors';
import { MarketingApi } from '../../core/api/marketing-api';
import type { DiscountType } from '../../core/api/models';
import { Button } from '../../shared/button';
import { FieldError } from '../../shared/field-error';
import { Modal } from '../../shared/modal';
import { ToastService } from '../../shared/toast';

/** A percentage discount can't go above 100; a fixed amount has no upper bound. */
function percentAtMost100(group: AbstractControl): ValidationErrors | null {
  const type: unknown = group.get('discountType')?.value;
  const amount: unknown = group.get('amount')?.value;
  return type === 'PERCENT' && typeof amount === 'number' && amount > 100
    ? { max: { max: 100, actual: amount } }
    : null;
}

/**
 * The "New promotion" modal from features/marketing/MarketingScreen.tsx.
 * Creating invalidates the `Marketing` tag, so the stats and the promotions
 * grid reload by themselves.
 *
 * `amount` is what the tutor types — a percentage, or dollars for a fixed
 * discount — and becomes `discountValue` (percent, or cents) on submit. React
 * stored cents in the form and divided for display, so switching 15 % to
 * "Fixed" showed $0.15; here the typed number stays put.
 */
@Component({
  selector: 'th-new-promotion-modal',
  imports: [ReactiveFormsModule, Button, FieldError, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-promotion-modal.html',
})
export class NewPromotionModal {
  private readonly api = inject(MarketingApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  // The minimum lengths match CreatePromotionInput's class-validator rules.
  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      code: ['', [Validators.required, Validators.minLength(3)]],
      discountType: this.fb.control<DiscountType>('PERCENT'),
      amount: [15, [Validators.required, Validators.min(1)]],
    },
    { validators: percentAtMost100 },
  );
  /** Drives the amount label; form values aren't signals, so bridge them once. */
  protected readonly discountType = toSignal(this.form.controls.discountType.valueChanges, {
    initialValue: this.form.controls.discountType.value,
  });
  protected readonly creating = signal(false);

  constructor() {
    // React upper-cased the code on every keystroke; same here, for typed and
    // pasted text alike. `emitEvent: false` stops this from re-triggering itself.
    const code = this.form.controls.code;
    code.valueChanges
      .pipe(
        filter((v) => v !== v.toUpperCase()),
        takeUntilDestroyed(),
      )
      .subscribe((v) => code.setValue(v.toUpperCase(), { emitEvent: false }));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, code, discountType, amount } = this.form.getRawValue();
    const discountValue = discountType === 'PERCENT' ? amount : Math.round(amount * 100);
    this.creating.set(true);
    this.api
      .createPromotion({ name: name.trim(), code: code.trim(), discountType, discountValue })
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.show('Promotion created');
          this.closed.emit();
          this.form.reset();
        },
        error: (err: unknown) =>
          this.toast.show(`Could not create the promotion: ${errorMessage(err)}`),
      });
  }
}
