import { TestBed } from '@angular/core/testing';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { persistAccent, persistTheme } from './ui.effects';
import {
  ACCENT_KEY,
  THEME_KEY,
  UiActions,
  type UiState,
  initialUiState,
  uiFeature,
} from './ui.store';

/** Port of apps/dashboard/src/store/ui-slice.test.ts, plus the persistence effects. */
const base: UiState = {
  theme: 'light',
  accent: 'teal',
  online: true,
  sidebarOpen: false,
  newLessonOpen: false,
};
const reduce = uiFeature.reducer;

describe('ui feature', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('initial state', () => {
    it('starts light / teal / online with no drawer or modal open', () => {
      spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
      expect(initialUiState()).toEqual(base);
    });

    it('follows the OS dark preference when nothing is saved', () => {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
      expect(initialUiState().theme).toBe('dark');
    });

    it('prefers the saved theme and accent, and ignores unknown values', () => {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
      localStorage.setItem(THEME_KEY, 'light');
      localStorage.setItem(ACCENT_KEY, 'plum');
      expect(initialUiState()).toEqual(
        jasmine.objectContaining({ theme: 'light', accent: 'plum' }),
      );

      localStorage.setItem(ACCENT_KEY, 'neon');
      expect(initialUiState().accent).toBe('teal');
    });
  });

  describe('reducer', () => {
    it('sets and toggles the theme', () => {
      expect(reduce(base, UiActions.setTheme({ theme: 'dark' })).theme).toBe('dark');
      expect(reduce(base, UiActions.toggleTheme()).theme).toBe('dark');
      expect(reduce({ ...base, theme: 'dark' }, UiActions.toggleTheme()).theme).toBe('light');
    });

    it('sets the accent and online status', () => {
      expect(reduce(base, UiActions.setAccent({ accent: 'plum' })).accent).toBe('plum');
      expect(reduce(base, UiActions.setOnline({ online: false })).online).toBeFalse();
    });

    it('toggles and sets the mobile sidebar', () => {
      expect(reduce(base, UiActions.toggleSidebar()).sidebarOpen).toBeTrue();
      expect(
        reduce({ ...base, sidebarOpen: true }, UiActions.toggleSidebar()).sidebarOpen,
      ).toBeFalse();
      expect(reduce(base, UiActions.setSidebarOpen({ open: true })).sidebarOpen).toBeTrue();
    });

    it('opens and closes the New-lesson modal', () => {
      const open = reduce(base, UiActions.setNewLessonOpen({ open: true }));
      expect(open.newLessonOpen).toBeTrue();
      expect(reduce(open, UiActions.setNewLessonOpen({ open: false })).newLessonOpen).toBeFalse();
    });

    it('never mutates the previous state', () => {
      const before = { ...base };
      reduce(base, UiActions.toggleTheme());
      expect(base).toEqual(before);
    });
  });

  describe('effects', () => {
    let store: MockStore;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideMockStore()] });
      store = TestBed.inject<MockStore<object>>(MockStore);
    });

    it('persists the theme read back from the store after a toggle', () => {
      // toggleTheme has no payload: the effect reads the new value from the store.
      store.overrideSelector(uiFeature.selectTheme, 'dark');
      const actions$ = new Actions(of(UiActions.toggleTheme()));

      persistTheme(actions$, store).subscribe();

      expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    });

    it('persists the accent from the action payload', () => {
      const actions$ = new Actions(of(UiActions.setAccent({ accent: 'indigo' })));
      persistAccent(actions$).subscribe();
      expect(localStorage.getItem(ACCENT_KEY)).toBe('indigo');
    });

    it('ignores actions it does not handle', () => {
      const actions$ = new Actions(of(UiActions.setOnline({ online: false })));
      persistTheme(actions$, store).subscribe();
      persistAccent(actions$).subscribe();
      expect(localStorage.length).toBe(0);
    });
  });
});
