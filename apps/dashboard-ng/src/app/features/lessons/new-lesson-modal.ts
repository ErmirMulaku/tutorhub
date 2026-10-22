import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { BookingsApi } from '../../core/api/bookings-api';
import { cachedQuery } from '../../core/api/cache-tags';
import { BookingsActions, bookingsFeature } from '../../core/bookings/bookings.store';
import { UiActions, uiFeature } from '../../core/ui/ui.store';
import { Button } from '../../shared/button';
import { Modal } from '../../shared/modal';

/** Keep the current pick while it's still in the list; otherwise default to the first item. */
function keepOrFirst(
  list: readonly { id: string }[] | undefined,
  current: string | undefined,
): string {
  if (list === undefined) return current ?? '';
  return list.some((item) => item.id === current) ? (current ?? '') : (list[0]?.id ?? '');
}

/**
 * Port of features/lessons/NewLessonModal.tsx — a tutor-initiated booking,
 * opened from the topbar's "New lesson" button and mounted once in the shell.
 */
@Component({
  selector: 'th-new-lesson-modal',
  imports: [Button, Modal],
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

  // React defaulted the pickers with a useEffect that called setState. Here the
  // selection is *derived* from the list (linkedSignal): it recomputes when the
  // list changes, yet stays writable for the user's own pick.
  protected readonly studentId = linkedSignal<readonly { id: string }[] | undefined, string>({
    source: this.students.data,
    computation: (list, previous) => keepOrFirst(list, previous?.value),
  });
  protected readonly subjectId = linkedSignal<readonly { id: string }[] | undefined, string>({
    source: this.subjects.data,
    computation: (list, previous) => keepOrFirst(list, previous?.value),
  });
  protected readonly startTime = signal('');

  constructor() {
    // The bookings effect closes the modal and shows the toast; the form only
    // has to clear its date. Reacting to an *event* (an action), not to state.
    inject(Actions)
      .pipe(ofType(BookingsActions.createLessonSuccess), takeUntilDestroyed())
      .subscribe(() => this.startTime.set(''));
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected close(): void {
    this.store.dispatch(UiActions.setNewLessonOpen({ open: false }));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const studentId = this.studentId();
    const subjectId = this.subjectId();
    const startTime = this.startTime();
    if (!studentId || !subjectId || startTime === '') return;
    this.store.dispatch(
      BookingsActions.createLesson({
        input: { studentId, subjectId, startTime: new Date(startTime).toISOString() },
      }),
    );
  }
}
