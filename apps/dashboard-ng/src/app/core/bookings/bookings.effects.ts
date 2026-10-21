import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of, switchMap, tap } from 'rxjs';
import { BookingsApi, type BookingTransition } from '../api/bookings-api';
import { CacheTags } from '../api/cache-tags';
import { errorMessage } from '../api/errors';
import { UiActions } from '../ui/ui.store';
import { ToastService } from '../../shared/toast';
import { BookingsActions } from './bookings.store';

/**
 * Loads use `switchMap`: if a refetch starts while one is in flight, the older
 * request is cancelled and only the newest answer lands in the store.
 */
export const loadLessons = createEffect(
  (actions$ = inject(Actions), api = inject(BookingsApi)) =>
    actions$.pipe(
      ofType(BookingsActions.loadLessons),
      switchMap(() =>
        api.tutorBookings().pipe(
          map((bookings) => BookingsActions.loadLessonsSuccess({ bookings })),
          catchError((err: unknown) =>
            of(BookingsActions.loadLessonsFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadToday = createEffect(
  (actions$ = inject(Actions), api = inject(BookingsApi)) =>
    actions$.pipe(
      ofType(BookingsActions.loadToday),
      switchMap(() =>
        api.todaySchedule().pipe(
          map((bookings) => BookingsActions.loadTodaySuccess({ bookings })),
          catchError((err: unknown) =>
            of(BookingsActions.loadTodayFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

/**
 * Status changes use `mergeMap`: accepting one booking must not cancel the
 * decline of another, so each request runs independently. (The API call also
 * invalidates Booking / DashboardSummary / Notifications, which reloads the lists.)
 */
export const changeStatus = createEffect(
  (actions$ = inject(Actions), api = inject(BookingsApi)) =>
    actions$.pipe(
      ofType(BookingsActions.changeStatus),
      mergeMap(({ booking, transition }) =>
        api.transition(booking.id, transition).pipe(
          map(({ id, status }) =>
            BookingsActions.changeStatusSuccess({
              id,
              status,
              transition,
              studentName: booking.student.fullName,
            }),
          ),
          catchError((err: unknown) =>
            of(BookingsActions.changeStatusFailure({ id: booking.id, error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

const TOAST: Record<BookingTransition, (studentName: string) => string> = {
  accept: (name) => `Accepted ${name}'s lesson`,
  decline: (name) => `Declined ${name}'s request`,
  complete: () => 'Lesson marked complete',
};

/** Same toasts the React screen showed after `.unwrap()` resolved. */
export const changeStatusToast = createEffect(
  (actions$ = inject(Actions), toast = inject(ToastService)) =>
    actions$.pipe(
      ofType(BookingsActions.changeStatusSuccess),
      tap(({ transition, studentName }) => toast.show(TOAST[transition](studentName))),
    ),
  { functional: true, dispatch: false },
);

/** A failed accept/decline/complete used to fail silently; now the tutor is told. */
export const changeStatusFailedToast = createEffect(
  (actions$ = inject(Actions), toast = inject(ToastService)) =>
    actions$.pipe(
      ofType(BookingsActions.changeStatusFailure),
      tap(({ error }) => toast.show(`Could not update the lesson: ${error}`)),
    ),
  { functional: true, dispatch: false },
);

/** No double-submit guard needed in the stream: the button is disabled while `creating`. */
export const createLesson = createEffect(
  (actions$ = inject(Actions), api = inject(BookingsApi)) =>
    actions$.pipe(
      ofType(BookingsActions.createLesson),
      mergeMap(({ input }) =>
        api.createLesson(input).pipe(
          map(({ id }) => BookingsActions.createLessonSuccess({ id })),
          catchError((err: unknown) =>
            of(BookingsActions.createLessonFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

/** On success: toast + close the modal — one action in, another action out. */
export const createLessonSucceeded = createEffect(
  (actions$ = inject(Actions), toast = inject(ToastService)) =>
    actions$.pipe(
      ofType(BookingsActions.createLessonSuccess),
      tap(() => toast.show('Lesson booked')),
      map(() => UiActions.setNewLessonOpen({ open: false })),
    ),
  { functional: true },
);

export const createLessonFailed = createEffect(
  (actions$ = inject(Actions), toast = inject(ToastService)) =>
    actions$.pipe(
      ofType(BookingsActions.createLessonFailure),
      tap(() => toast.show('Could not book the lesson')),
    ),
  { functional: true, dispatch: false },
);

/**
 * A live `bookingChanged` invalidates the same tags the React hook did, so
 * every list, KPI and the notifications feed on screen refetches.
 */
export const liveChangedRefetch = createEffect(
  (actions$ = inject(Actions), tags = inject(CacheTags)) =>
    actions$.pipe(
      ofType(BookingsActions.liveChanged),
      tap(() => tags.invalidate('Booking', 'DashboardSummary', 'Notifications')),
    ),
  { functional: true, dispatch: false },
);
