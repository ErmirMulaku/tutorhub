import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { of } from 'rxjs';
import { clearCredentials, persistCredentials } from './auth.effects';
import { AuthActions, TOKEN_KEY, TUTOR_KEY, authFeature, initialAuthState } from './auth.store';

describe('auth feature', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('reducer + selectors', () => {
    it('restores a persisted session (same keys as the React app)', () => {
      localStorage.setItem(TOKEN_KEY, 'jwt-a');
      localStorage.setItem(TUTOR_KEY, 't1');
      expect(initialAuthState()).toEqual({ token: 'jwt-a', tutorId: 't1' });
    });

    it('starts signed out when nothing is stored', () => {
      expect(initialAuthState()).toEqual({ token: null, tutorId: null });
    });

    it('sets and clears credentials', () => {
      const signedIn = authFeature.reducer(
        { token: null, tutorId: null },
        AuthActions.setCredentials({ token: 'jwt-b', tutorId: 't2' }),
      );
      expect(signedIn).toEqual({ token: 'jwt-b', tutorId: 't2' });
      expect(authFeature.reducer(signedIn, AuthActions.clearCredentials())).toEqual({
        token: null,
        tutorId: null,
      });
    });

    it('derives selectIsSignedIn from the token', () => {
      // `projector` runs a memoised selector's last step on plain inputs.
      expect(authFeature.selectIsSignedIn.projector('jwt')).toBeTrue();
      expect(authFeature.selectIsSignedIn.projector(null)).toBeFalse();
    });
  });

  describe('effects', () => {
    it('writes a new session to localStorage', () => {
      const actions$ = new Actions(of(AuthActions.setCredentials({ token: 'jwt', tutorId: 't9' })));
      persistCredentials(actions$).subscribe();
      expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt');
      expect(localStorage.getItem(TUTOR_KEY)).toBe('t9');
    });

    it('forgets the session and redirects to /login on sign-out', () => {
      localStorage.setItem(TOKEN_KEY, 'jwt');
      localStorage.setItem(TUTOR_KEY, 't9');
      const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
      router.navigateByUrl.and.resolveTo(true);

      clearCredentials(new Actions(of(AuthActions.clearCredentials())), router).subscribe();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(TUTOR_KEY)).toBeNull();
      // replaceUrl: Back must not return to a page that needs the old session.
      expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/login', { replaceUrl: true });
    });

    it('also works in a real injection context', () => {
      // The same effect resolved through DI, as NgRx runs it in the app.
      const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
      router.navigateByUrl.and.resolveTo(true);
      TestBed.configureTestingModule({
        providers: [
          { provide: Router, useValue: router },
          { provide: Actions, useValue: new Actions(of(AuthActions.clearCredentials())) },
        ],
      });
      TestBed.runInInjectionContext(() => clearCredentials().subscribe());
      expect(router.navigateByUrl).toHaveBeenCalled();
    });
  });
});
