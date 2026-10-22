import { TestBed } from '@angular/core/testing';
import { Store, provideState, provideStore } from '@ngrx/store';
import { booking } from '../../../testing/factories';
import { BookingsActions, bookingsFeature } from '../bookings/bookings.store';
import { DashboardActions, dashboardFeature } from '../dashboard/dashboard.store';
import { UiActions, uiFeature } from '../ui/ui.store';
import { AuthActions, authFeature } from './auth.store';
import { resetOnAuthChange } from './reset-on-auth-change';

/**
 * Port of apps/dashboard/src/store/auth-cache-reset.test.ts — a real store with
 * the real meta-reducer, not a mock: the point is that the previous tutor's
 * cached data is gone the moment the session changes.
 */
describe('resetOnAuthChange meta-reducer', () => {
  let store: Store;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideStore({}, { metaReducers: [resetOnAuthChange] }),
        provideState(authFeature),
        provideState(uiFeature),
        provideState(dashboardFeature),
        provideState(bookingsFeature),
      ],
    });
    store = TestBed.inject<Store<object>>(Store);
    // Seed the cache the way a signed-in session would, without the network.
    store.dispatch(AuthActions.setCredentials({ token: 'token-a', tutorId: 't1' }));
    store.dispatch(
      DashboardActions.loadMeSuccess({ me: { id: 't1', name: 'New Acc', headline: null } }),
    );
    store.dispatch(BookingsActions.loadLessonsSuccess({ bookings: [booking()] }));
    store.dispatch(UiActions.setAccent({ accent: 'plum' }));
  });

  afterEach(() => localStorage.clear());

  const me = (): unknown => store.selectSignal(dashboardFeature.selectMe)();
  const lessons = (): unknown[] => store.selectSignal(bookingsFeature.selectLessons)();

  it('drops the previous account cache when a new tutor signs in', () => {
    expect(me()).toEqual(jasmine.objectContaining({ name: 'New Acc' }));
    expect(lessons().length).toBe(1);

    store.dispatch(AuthActions.setCredentials({ token: 'token-b', tutorId: 't2' }));

    // Otherwise the next account renders "New Acc" until each query refetches.
    expect(me()).toBeNull();
    expect(lessons()).toEqual([]);
    expect(store.selectSignal(authFeature.selectTutorId)()).toBe('t2');
  });

  it('drops the cache on sign-out', () => {
    store.dispatch(AuthActions.clearCredentials());
    expect(me()).toBeNull();
    expect(lessons()).toEqual([]);
  });

  it('keeps the session-independent UI state (the accent survives sign-out)', () => {
    // Not the theme: its default follows the OS, so it could equal the reset value.
    store.dispatch(AuthActions.clearCredentials());
    expect(store.selectSignal(uiFeature.selectAccent)()).toBe('plum');
  });

  it('leaves data alone for every other action', () => {
    store.dispatch(UiActions.toggleSidebar());
    expect(me()).toEqual(jasmine.objectContaining({ name: 'New Acc' }));
  });
});
