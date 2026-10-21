import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { type Observable, filter, finalize } from 'rxjs';
import { AvailabilityApi } from '../../core/api/availability-api';
import { cachedQuery } from '../../core/api/cache-tags';
import { errorMessage } from '../../core/api/errors';
import { endAfterStart } from '../../core/validators';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { FieldError } from '../../shared/field-error';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';
import { WeeklyHoursEditor } from './weekly-hours-editor';

/** Port of features/availability/AvailabilityScreen.tsx — weekly hours, booking rules, time off. */
@Component({
  selector: 'th-availability-page',
  imports: [ReactiveFormsModule, Button, Card, ErrorState, FieldError, Skeleton, WeeklyHoursEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './availability-page.html',
})
export class AvailabilityPage {
  private readonly api = inject(AvailabilityApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly availability = cachedQuery({
    tags: ['Availability'],
    load: () => this.api.myAvailability(),
  });

  // The same defaults React showed before data arrived.
  protected readonly rules = this.fb.group({
    bufferMinutes: [15, [Validators.required, Validators.min(0)]],
    minNoticeHours: [4, [Validators.required, Validators.min(0)]],
    maxLessonsPerDay: [6, [Validators.required, Validators.min(1)]],
  });
  protected readonly timeOff = this.fb.group(
    {
      label: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
    },
    // A one-day break (same start and end date) is allowed.
    { validators: endAfterStart('startDate', 'endDate', true) },
  );
  protected readonly savingRules = signal(false);

  constructor() {
    toObservable(this.availability.data)
      .pipe(
        filter((data) => data !== undefined),
        takeUntilDestroyed(),
      )
      .subscribe(({ bufferMinutes, minNoticeHours, maxLessonsPerDay }) =>
        this.rules.reset({ bufferMinutes, minNoticeHours, maxLessonsPerDay }),
      );
  }

  protected saveRules(): void {
    if (this.rules.invalid) {
      this.rules.markAllAsTouched();
      return;
    }
    this.savingRules.set(true);
    this.run(
      // finalize runs when the request ends either way — success or error.
      this.api
        .updateBookingRules(this.rules.getRawValue())
        .pipe(finalize(() => this.savingRules.set(false))),
      'Booking rules saved',
    );
  }

  protected addTimeOff(): void {
    if (this.timeOff.invalid) {
      this.timeOff.markAllAsTouched();
      return;
    }
    const { label, startDate, endDate } = this.timeOff.getRawValue();
    this.run(
      this.api.addTimeOff({
        label,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      }),
      'Time off added',
      () => this.timeOff.reset(),
    );
  }

  protected removeTimeOff(id: string): void {
    this.run(this.api.removeTimeOff(id), null);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB');
  }

  /** Run a save; toast the success message (if any) or the failure. */
  private run(
    request: Observable<void>,
    success: string | null,
    onSuccess: () => void = () => undefined,
  ): void {
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        onSuccess();
        if (success) this.toast.show(success);
      },
      error: (err: unknown) => this.toast.show(`Could not save: ${errorMessage(err)}`),
    });
  }
}
