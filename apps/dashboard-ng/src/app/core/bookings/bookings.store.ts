import { BookingStatus } from '@ermulaku/types';
import { type EntityState, createEntityAdapter } from '@ngrx/entity';
import {
  createActionGroup,
  createFeature,
  createReducer,
  createSelector,
  emptyProps,
  on,
  props,
} from '@ngrx/store';
import type { BookingTransition } from '../api/bookings-api';
import type { CreateLessonInput, TutorBooking } from '../api/models';
import type { BookingChangedEvent } from '../live/live-socket.service';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

const STATUSES: readonly string[] = Object.values(BookingStatus);
/** The socket payload types `status` as a plain string; only trust known values. */
function isBookingStatus(value: string): value is BookingStatus {
  return STATUSES.includes(value);
}

/**
 * Bookings, normalised. The entity adapter stores each booking once, by id
 * (`ids` + `entities`), however many lists it appears in. Two lists reference
 * them, mirroring the two React queries:
 * - `lessonIds` — `tutorBookings` (every booking; the Lessons screen),
 * - `todayIds`  — `todaySchedule` (the API's timezone-aware "today"),
 * - `rangeIds`  — `tutorBookings(from, to)` for the calendar's visible window.
 */
export interface BookingsState extends EntityState<TutorBooking> {
  lessonIds: string[];
  todayIds: string[];
  rangeIds: string[];
  lessonsStatus: LoadStatus;
  todayStatus: LoadStatus;
  rangeStatus: LoadStatus;
  error: string | null;
  /** A New-lesson request is in flight (React: the mutation's `isLoading`). */
  creating: boolean;
}

export const bookingsAdapter = createEntityAdapter<TutorBooking>();

const initialState: BookingsState = bookingsAdapter.getInitialState({
  lessonIds: [],
  todayIds: [],
  rangeIds: [],
  lessonsStatus: 'idle',
  todayStatus: 'idle',
  rangeStatus: 'idle',
  error: null,
  creating: false,
});

/**
 * Every load and mutation is a request action plus a success and a failure
 * action — the request goes out from an effect (bookings.effects.ts).
 */
export const BookingsActions = createActionGroup({
  source: 'Bookings',
  events: {
    'Load Lessons': emptyProps(),
    'Load Lessons Success': props<{ bookings: TutorBooking[] }>(),
    'Load Lessons Failure': props<{ error: string }>(),

    'Load Today': emptyProps(),
    'Load Today Success': props<{ bookings: TutorBooking[] }>(),
    'Load Today Failure': props<{ error: string }>(),

    'Load Range': props<{ from: string; to: string }>(),
    'Load Range Success': props<{ bookings: TutorBooking[] }>(),
    'Load Range Failure': props<{ error: string }>(),

    'Change Status': props<{ booking: TutorBooking; transition: BookingTransition }>(),
    'Change Status Success': props<{
      id: string;
      status: BookingStatus;
      transition: BookingTransition;
      studentName: string;
    }>(),
    'Change Status Failure': props<{ id: string; error: string }>(),

    'Create Lesson': props<{ input: CreateLessonInput }>(),
    'Create Lesson Success': props<{ id: string }>(),
    'Create Lesson Failure': props<{ error: string }>(),

    /** Pushed by the API's Socket.IO gateway (someone changed a booking). */
    'Live Changed': props<{ change: BookingChangedEvent }>(),
  },
});

export const bookingsFeature = createFeature({
  name: 'bookings',
  reducer: createReducer(
    initialState,
    on(
      BookingsActions.loadLessons,
      (state): BookingsState => ({
        ...state,
        // Keep showing the old list while refetching (only the first load is "loading").
        lessonsStatus: state.lessonsStatus === 'loaded' ? 'loaded' : 'loading',
      }),
    ),
    on(
      BookingsActions.loadLessonsSuccess,
      (state, { bookings }): BookingsState =>
        bookingsAdapter.upsertMany(bookings, {
          ...state,
          lessonIds: bookings.map((b) => b.id),
          lessonsStatus: 'loaded',
          error: null,
        }),
    ),
    on(
      BookingsActions.loadLessonsFailure,
      (state, { error }): BookingsState => ({
        ...state,
        lessonsStatus: 'error',
        error,
      }),
    ),

    on(
      BookingsActions.loadToday,
      (state): BookingsState => ({
        ...state,
        todayStatus: state.todayStatus === 'loaded' ? 'loaded' : 'loading',
      }),
    ),
    on(
      BookingsActions.loadTodaySuccess,
      (state, { bookings }): BookingsState =>
        bookingsAdapter.upsertMany(bookings, {
          ...state,
          todayIds: bookings.map((b) => b.id),
          todayStatus: 'loaded',
          error: null,
        }),
    ),
    on(
      BookingsActions.loadTodayFailure,
      (state, { error }): BookingsState => ({
        ...state,
        todayStatus: 'error',
        error,
      }),
    ),

    on(
      BookingsActions.loadRange,
      (state): BookingsState => ({
        ...state,
        rangeStatus: state.rangeStatus === 'loaded' ? 'loaded' : 'loading',
      }),
    ),
    on(
      BookingsActions.loadRangeSuccess,
      (state, { bookings }): BookingsState =>
        bookingsAdapter.upsertMany(bookings, {
          ...state,
          rangeIds: bookings.map((b) => b.id),
          rangeStatus: 'loaded',
          error: null,
        }),
    ),
    on(
      BookingsActions.loadRangeFailure,
      (state, { error }): BookingsState => ({ ...state, rangeStatus: 'error', error }),
    ),

    // Apply the server's answer straight away; the tag invalidation refetches anyway.
    on(
      BookingsActions.changeStatusSuccess,
      (state, { id, status }): BookingsState =>
        bookingsAdapter.updateOne({ id, changes: { status } }, state),
    ),
    on(
      BookingsActions.changeStatusFailure,
      (state, { error }): BookingsState => ({
        ...state,
        error,
      }),
    ),

    // A live change patches the booking we already hold right away (updateOne
    // ignores unknown ids); the follow-up refetch brings in anything new.
    on(
      BookingsActions.liveChanged,
      (state, { change }): BookingsState =>
        isBookingStatus(change.status)
          ? bookingsAdapter.updateOne(
              {
                id: change.id,
                changes: {
                  status: change.status,
                  startTime: change.startTime,
                  endTime: change.endTime,
                },
              },
              state,
            )
          : state,
    ),

    on(BookingsActions.createLesson, (state): BookingsState => ({ ...state, creating: true })),
    on(
      BookingsActions.createLessonSuccess,
      (state): BookingsState => ({
        ...state,
        creating: false,
      }),
    ),
    on(
      BookingsActions.createLessonFailure,
      (state, { error }): BookingsState => ({
        ...state,
        creating: false,
        error,
      }),
    ),
  ),
  extraSelectors: ({
    selectBookingsState,
    selectEntities,
    selectLessonIds,
    selectTodayIds,
    selectRangeIds,
  }) => {
    const { selectAll } = bookingsAdapter.getSelectors(selectBookingsState);
    const resolve = (
      ids: string[],
      entities: Record<string, TutorBooking | undefined>,
    ): TutorBooking[] => ids.flatMap((id) => entities[id] ?? []);
    const selectLessons = createSelector(selectLessonIds, selectEntities, resolve);
    return {
      selectAll,
      selectLessons,
      selectToday: createSelector(selectTodayIds, selectEntities, resolve),
      selectRange: createSelector(selectRangeIds, selectEntities, resolve),
      selectPendingCount: createSelector(
        selectLessons,
        (bookings) => bookings.filter((b) => b.status === 'PENDING').length,
      ),
    };
  },
});
