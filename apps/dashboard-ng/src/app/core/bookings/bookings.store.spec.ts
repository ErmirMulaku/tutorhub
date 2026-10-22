import { booking } from '../../../testing/factories';
import type { BookingChangedEvent } from '../live/live-socket.service';
import { BookingsActions, type BookingsState, bookingsFeature } from './bookings.store';

const reduce = bookingsFeature.reducer;
const initial = (): BookingsState => reduce(undefined, { type: '@@init' });
/** Feature selectors read the root state, where this slice lives under `bookings`. */
const root = (bookings: BookingsState): { bookings: BookingsState } => ({ bookings });

const mia = booking({ id: 'b1', status: 'PENDING' });
const tom = booking({
  id: 'b2',
  status: 'CONFIRMED',
  student: { id: 's2', fullName: 'Tom Becker', avatarColor: null },
});

function change(overrides: Partial<BookingChangedEvent>): BookingChangedEvent {
  return {
    id: 'b1',
    tutorId: 't1',
    studentId: 's1',
    subjectId: 'sub1',
    startTime: mia.startTime,
    endTime: mia.endTime,
    status: 'CONFIRMED',
    ...overrides,
  };
}

describe('bookings feature', () => {
  it('stores loaded lessons once, by id, and lists them in API order', () => {
    const state = reduce(initial(), BookingsActions.loadLessonsSuccess({ bookings: [tom, mia] }));
    expect(state.ids).toEqual(['b2', 'b1']);
    expect(state.lessonIds).toEqual(['b2', 'b1']);
    expect(state.lessonsStatus).toBe('loaded');
    expect(bookingsFeature.selectLessons(root(state)).map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('shares one entity between lists — an update shows up everywhere', () => {
    let state = reduce(initial(), BookingsActions.loadLessonsSuccess({ bookings: [mia, tom] }));
    // Today's schedule brings the same booking back, now confirmed.
    state = reduce(
      state,
      BookingsActions.loadTodaySuccess({ bookings: [{ ...mia, status: 'CONFIRMED' }] }),
    );

    expect(state.ids.length).toBe(2); // still one copy of b1
    expect(bookingsFeature.selectToday(root(state))[0]?.status).toBe('CONFIRMED');
    expect(bookingsFeature.selectLessons(root(state))[0]?.status).toBe('CONFIRMED');
  });

  it('only shows a loading state for the first load, not refetches', () => {
    let state = reduce(initial(), BookingsActions.loadLessons());
    expect(state.lessonsStatus).toBe('loading');
    state = reduce(state, BookingsActions.loadLessonsSuccess({ bookings: [mia] }));
    expect(reduce(state, BookingsActions.loadLessons()).lessonsStatus).toBe('loaded');
  });

  it('records a failed load', () => {
    const state = reduce(initial(), BookingsActions.loadLessonsFailure({ error: 'offline' }));
    expect(state.lessonsStatus).toBe('error');
    expect(state.error).toBe('offline');
  });

  it('applies a status change from the server', () => {
    let state = reduce(initial(), BookingsActions.loadLessonsSuccess({ bookings: [mia] }));
    state = reduce(
      state,
      BookingsActions.changeStatusSuccess({
        id: 'b1',
        status: 'CONFIRMED',
        transition: 'accept',
        studentName: 'Mia Chen',
      }),
    );
    expect(state.entities['b1']?.status).toBe('CONFIRMED');
  });

  describe('live changes (Socket.IO)', () => {
    const loaded = (): BookingsState =>
      reduce(initial(), BookingsActions.loadLessonsSuccess({ bookings: [mia, tom] }));

    it('patches a booking it already holds: status and times', () => {
      const moved = '2026-10-21T11:00:00.000Z';
      const state = reduce(
        loaded(),
        BookingsActions.liveChanged({ change: change({ startTime: moved }) }),
      );
      expect(state.entities['b1']).toEqual(
        jasmine.objectContaining({ status: 'CONFIRMED', startTime: moved }),
      );
    });

    it('ignores a status it does not know (the payload is a plain string)', () => {
      const before = loaded();
      expect(
        reduce(before, BookingsActions.liveChanged({ change: change({ status: 'ARCHIVED' }) })),
      ).toBe(before);
    });

    it('ignores a booking it has never loaded (the refetch brings it in)', () => {
      const state = reduce(
        loaded(),
        BookingsActions.liveChanged({ change: change({ id: 'b99' }) }),
      );
      expect(state.ids).toEqual(['b1', 'b2']);
    });
  });

  it('counts pending lessons for the sidebar badge', () => {
    const state = reduce(initial(), BookingsActions.loadLessonsSuccess({ bookings: [mia, tom] }));
    expect(bookingsFeature.selectPendingCount(root(state))).toBe(1);
  });

  it('tracks the New-lesson request in flight', () => {
    const input = { studentId: 's1', subjectId: 'sub1', startTime: mia.startTime };
    const creating = reduce(initial(), BookingsActions.createLesson({ input }));
    expect(creating.creating).toBeTrue();
    expect(
      reduce(creating, BookingsActions.createLessonSuccess({ id: 'b3' })).creating,
    ).toBeFalse();
    expect(
      reduce(creating, BookingsActions.createLessonFailure({ error: 'x' })).creating,
    ).toBeFalse();
  });
});
