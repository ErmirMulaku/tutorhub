import { Actions } from '@ngrx/effects';
import { of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { booking } from '../../../testing/factories';
import type { BookingsApi } from '../api/bookings-api';
import { CacheTags } from '../api/cache-tags';
import { GraphqlError } from '../api/graphql-client';
import { UiActions } from '../ui/ui.store';
import { ToastService } from '../../shared/toast';
import {
  changeStatus,
  changeStatusToast,
  createLessonSucceeded,
  liveChangedRefetch,
  loadRange,
} from './bookings.effects';
import { BookingsActions } from './bookings.store';

/**
 * Marble tests: each character of a diagram is one frame of virtual time.
 * `-` is a frame with nothing, a letter is an emitted value, `#` an error.
 * `hot` is the stream of actions; `cold` is an HTTP call that starts when
 * something subscribes to it. `TestScheduler.run` executes the timeline
 * synchronously, so the timing claims below are exact, not flaky.
 */
describe('bookings effects', () => {
  let scheduler: TestScheduler;
  let api: jasmine.SpyObj<BookingsApi>;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    api = jasmine.createSpyObj<BookingsApi>('BookingsApi', [
      'tutorBookings',
      'transition',
      'createLesson',
    ]);
  });

  const week1 = [booking({ id: 'b1' })];
  const week2 = [booking({ id: 'b2' })];

  it('loadRange (switchMap): paging on cancels the stale request', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const actions$ = new Actions(
        hot('-a-b', {
          a: BookingsActions.loadRange({ from: 'w1', to: 'w1-end' }),
          b: BookingsActions.loadRange({ from: 'w2', to: 'w2-end' }),
        }),
      );
      // Week 1 answers at frame 4, but week 2 is requested at frame 3 first.
      api.tutorBookings.and.callFake((args) =>
        args?.from === 'w1' ? cold('---x', { x: week1 }) : cold('--y', { y: week2 }),
      );

      // Only week 2 lands (frame 3 + 2): week 1's answer is never applied.
      expectObservable(loadRange(actions$, api)).toBe('-----s', {
        s: BookingsActions.loadRangeSuccess({ bookings: week2 }),
      });
    });
  });

  it('changeStatus (mergeMap): two updates run side by side, neither cancelled', () => {
    const mia = booking({ id: 'b1' });
    const tom = booking({
      id: 'b2',
      student: { id: 's2', fullName: 'Tom Becker', avatarColor: null },
    });
    scheduler.run(({ hot, cold, expectObservable }) => {
      const actions$ = new Actions(
        hot('-a-b', {
          a: BookingsActions.changeStatus({ booking: mia, transition: 'accept' }),
          b: BookingsActions.changeStatus({ booking: tom, transition: 'decline' }),
        }),
      );
      api.transition.and.callFake((id) =>
        id === 'b1'
          ? cold('----x', { x: { id: 'b1', status: 'CONFIRMED' as const } })
          : cold('-y', { y: { id: 'b2', status: 'CANCELLED' as const } }),
      );

      // Tom's faster answer arrives first (frame 4), Mia's still lands (frame 5).
      expectObservable(changeStatus(actions$, api)).toBe('----tm', {
        t: BookingsActions.changeStatusSuccess({
          id: 'b2',
          status: 'CANCELLED',
          transition: 'decline',
          studentName: 'Tom Becker',
        }),
        m: BookingsActions.changeStatusSuccess({
          id: 'b1',
          status: 'CONFIRMED',
          transition: 'accept',
          studentName: 'Mia Chen',
        }),
      });
    });
  });

  it('changeStatus: a failure becomes an action and the effect keeps working', () => {
    const mia = booking({ id: 'b1' });
    scheduler.run(({ hot, cold, expectObservable }) => {
      const actions$ = new Actions(
        hot('-a--a', { a: BookingsActions.changeStatus({ booking: mia, transition: 'accept' }) }),
      );
      api.transition.and.returnValues(
        cold('#', undefined, new GraphqlError('Booking is not pending', [])),
        cold('x', { x: { id: 'b1', status: 'CONFIRMED' as const } }),
      );

      // Without catchError *inside* mergeMap the first error would kill the effect.
      expectObservable(changeStatus(actions$, api)).toBe('-f--s', {
        f: BookingsActions.changeStatusFailure({ id: 'b1', error: 'Booking is not pending' }),
        s: BookingsActions.changeStatusSuccess({
          id: 'b1',
          status: 'CONFIRMED',
          transition: 'accept',
          studentName: 'Mia Chen',
        }),
      });
    });
  });

  it('shows the same toast React did after an accept', () => {
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    const actions$ = new Actions(
      of(
        BookingsActions.changeStatusSuccess({
          id: 'b1',
          status: 'CONFIRMED',
          transition: 'accept',
          studentName: 'Mia Chen',
        }),
      ),
    );
    changeStatusToast(actions$, toast).subscribe();
    expect(toast.show).toHaveBeenCalledOnceWith("Accepted Mia Chen's lesson");
  });

  it('closes the New-lesson modal after booking (one action in, one out)', () => {
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    const out: unknown[] = [];
    createLessonSucceeded(
      new Actions(of(BookingsActions.createLessonSuccess({ id: 'b3' }))),
      toast,
    ).subscribe((a) => out.push(a));
    expect(out).toEqual([UiActions.setNewLessonOpen({ open: false })]);
    expect(toast.show).toHaveBeenCalledOnceWith('Lesson booked');
  });

  it('a live change refetches the same tags as the React hook', () => {
    const tags = new CacheTags();
    spyOn(tags, 'invalidate');
    const change = {
      id: 'b1',
      tutorId: 't1',
      studentId: 's1',
      subjectId: 'sub1',
      startTime: '',
      endTime: '',
      status: 'CONFIRMED',
    };
    liveChangedRefetch(new Actions(of(BookingsActions.liveChanged({ change }))), tags).subscribe();
    expect(tags.invalidate).toHaveBeenCalledOnceWith(
      'Booking',
      'DashboardSummary',
      'Notifications',
    );
  });
});
