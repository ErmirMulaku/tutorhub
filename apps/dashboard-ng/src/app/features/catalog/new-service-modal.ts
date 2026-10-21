import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Level } from '@ermulaku/types';
import { finalize } from 'rxjs';
import { CatalogApi } from '../../core/api/catalog-api';
import { errorMessage } from '../../core/api/errors';
import type { ServiceType } from '../../core/api/models';
import { Button } from '../../shared/button';
import { FieldError } from '../../shared/field-error';
import { Modal } from '../../shared/modal';
import { ToastService } from '../../shared/toast';

/**
 * Port of features/catalog/NewServiceModal.tsx — shared by the Catalog screen
 * and the onboarding Subjects step. Creating invalidates the `Service` tag, so
 * any list of services on screen reloads by itself.
 *
 * The form holds the price in dollars (what the tutor types) and converts to
 * cents on submit, instead of round-tripping cents through the input as React did.
 */
@Component({
  selector: 'th-new-service-modal',
  imports: [ReactiveFormsModule, Button, FieldError, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-service-modal.html',
})
export class NewServiceModal {
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input.required<boolean>();
  /** Extra class on the modal panel — onboarding uses it to lift the modal above its overlay. */
  readonly panelClass = input('');
  readonly closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    // Typed controls keep the unions (a plain 'ONE_ON_ONE' would widen to string).
    type: this.fb.control<ServiceType>('ONE_ON_ONE'),
    level: this.fb.control<Level>('ADVANCED'),
    priceUsd: [50, [Validators.required, Validators.min(0)]],
    durationMin: [60, [Validators.required, Validators.min(15)]],
    lessonsCount: [1, [Validators.required, Validators.min(1)]],
    description: [''],
  });
  protected readonly creating = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { priceUsd, description, ...rest } = this.form.getRawValue();
    this.creating.set(true);
    this.api
      .createService({ ...rest, description, priceCents: Math.round(priceUsd * 100) })
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.show('Service added');
          this.closed.emit();
          this.form.reset();
        },
        error: (err: unknown) => this.toast.show(`Could not add the service: ${errorMessage(err)}`),
      });
  }
}
