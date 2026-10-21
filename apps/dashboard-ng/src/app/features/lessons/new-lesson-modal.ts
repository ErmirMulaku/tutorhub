import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { BookingsApi } from '../../core/api/bookings-api';
import { cachedQuery } from '../../core/api/cache-tags';
import { BookingsActions, bookingsFeature } from '../../core/bookings/bookings.store';
import { UiActions, uiFeature } from '../../core/ui/ui.store';
import { Button } from '../../shared/button';
import { Modal } from '../../shared/modal';

/**
 * Port of features/lessons/NewLessonModal.tsx — a tutor-initiated booking,
 * opened from the topbar's "New lesson" button and mounted once in the shell.
 */
@Component({
  selector: 'th-new-lesson-modal',
  imports: [ReactiveFormsModule, Button, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-lesson-modal.html',
})
export class NewLessonModal {
  private readonly store = inject(Store);
  private readonly api = inject(BookingsApi);

  protected readonly open = this.store.selectSignal(uiFeature.selectNewLessonOpen);
  protected readonly creating = this.store.selectSignal(bookingsFeature.selectCreating);

  // `params` returns undefined while closed, so nothing is fetched until the
  // modal opens — React's `{ skip: !open }`.
  protected readonly students = cachedQuery({
    tags: ['Booking'],
    params: () => (this.open() ? true : undefined),
    load: () => this.api.myStudents(),
  });
  protected readonly subjects = cachedQuery({
    tags: ['Service'],
    params: () => (this.open() ? true : undefined),
    load: () => this.api.mySubjects(),
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    studentId: '',
    subjectId: '',
    startTime: '',
  });

  constructor() {
    // Default the pickers to the first option once data arrives.
    effect(() => {
      const first = this.students.data()?.[0];
      const control = this.form.controls.studentId;
      if (first && control.value === '') control.setValue(first.id);
    });
    effect(() => {
      const first = this.subjects.data()?.[0];
      const control = this.form.controls.subjectId;
      if (first && control.value === '') control.setValue(first.id);
    });

    // The effect closes the modal and shows the toast; the form clears its own
    // date here (React did all three in the mutation's `.then`).
    inject(Actions)
      .pipe(ofType(BookingsActions.createLessonSuccess), takeUntilDestroyed())
      .subscribe(() => this.form.controls.startTime.setValue(''));
  }

  protected close(): void {
    this.store.dispatch(UiActions.setNewLessonOpen({ open: false }));
  }

  protected submit(): void {
    const { studentId, subjectId, startTime } = this.form.getRawValue();
    if (!studentId || !subjectId || startTime === '') return;
    this.store.dispatch(
      BookingsActions.createLesson({
        input: { studentId, subjectId, startTime: new Date(startTime).toISOString() },
      }),
    );
  }
}
