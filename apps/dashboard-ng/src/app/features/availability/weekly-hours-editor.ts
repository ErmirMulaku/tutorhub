import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  type FormControl,
  type FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { filter, map } from 'rxjs';
import { AvailabilityApi } from '../../core/api/availability-api';
import { cachedQuery } from '../../core/api/cache-tags';
import { errorMessage } from '../../core/api/errors';
import type { WorkingHour } from '../../core/api/models';
import { endAfterStart } from '../../core/validators';
import { Button } from '../../shared/button';
import { FieldError } from '../../shared/field-error';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';
import { ToggleSwitch } from '../../shared/toggle-switch';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_WINDOW = { start: '09:00', end: '17:00' };

type DayForm = FormGroup<{
  enabled: FormControl<boolean>;
  start: FormControl<string>;
  end: FormControl<string>;
}>;

/** A day's window only has to make sense when the day is switched on. */
const openWindowIsValid = endAfterStart('start', 'end');
function dayWindow(group: AbstractControl): ValidationErrors | null {
  return group.get('enabled')?.value === true ? openWindowIsValid(group) : null;
}

/**
 * Port of features/availability/WeeklyHoursEditor.tsx — a toggle + time window
 * per weekday. Shared by the Availability screen and the onboarding wizard.
 *
 * The form is a typed FormArray of seven FormGroups (index = `Date#getDay()`),
 * so `getRawValue()` is fully typed and each day validates its own window.
 */
@Component({
  selector: 'th-weekly-hours-editor',
  imports: [ReactiveFormsModule, Button, FieldError, Skeleton, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './weekly-hours-editor.html',
})
export class WeeklyHoursEditor {
  private readonly api = inject(AvailabilityApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly dayNames = DAYS;
  protected readonly availability = cachedQuery({
    tags: ['Availability'],
    load: () => this.api.myAvailability(),
  });
  protected readonly days = this.fb.array<DayForm>(
    DAYS.map(() =>
      this.fb.group(
        {
          enabled: this.fb.control<boolean>(false),
          start: DEFAULT_WINDOW.start,
          end: DEFAULT_WINDOW.end,
        },
        { validators: dayWindow },
      ),
    ),
  );
  protected readonly saving = signal(false);

  constructor() {
    // Load the saved hours into the form whenever they (re)load — React's
    // `useEffect(() => setHours(...), [data])`. `emitEvent: false` keeps the
    // "toggle on → default window" listener below from firing for server data.
    toObservable(this.availability.data)
      .pipe(
        filter((data) => data !== undefined),
        map((data) => data.workingHours),
        takeUntilDestroyed(),
      )
      .subscribe((hours) => {
        this.days.reset(
          DAYS.map((_, day) => {
            const win = hours.find((h) => h.day === day);
            return win
              ? { enabled: true, start: win.start, end: win.end }
              : { enabled: false, ...DEFAULT_WINDOW };
          }),
          { emitEvent: false },
        );
      });

    // Switching a day on starts from 09:00–17:00, as in React.
    for (const day of this.days.controls) {
      day.controls.enabled.valueChanges
        .pipe(
          filter((on) => on),
          takeUntilDestroyed(),
        )
        .subscribe(() => day.patchValue(DEFAULT_WINDOW));
    }
  }

  protected save(): void {
    if (this.days.invalid) {
      this.days.markAllAsTouched();
      return;
    }
    const hours: WorkingHour[] = this.days
      .getRawValue()
      .flatMap((d, day) => (d.enabled ? [{ day, start: d.start, end: d.end }] : []));
    this.saving.set(true);
    this.api
      .updateWorkingHours(hours)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show('Availability saved');
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.toast.show(`Could not save availability: ${errorMessage(err)}`);
        },
      });
  }
}
