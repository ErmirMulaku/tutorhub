import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type GuardResult,
  type MaybeAsync,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { type Observable, Subject, isObservable, of, throwError } from 'rxjs';
import { ProfileService } from '../api/profile.service';
import { authGuard, onboardingGuard } from './auth.guards';
import { authFeature } from './auth.store';

/** Run a functional guard the way the router does: inside an injection context. */
function run(guard: CanActivateFn): MaybeAsync<GuardResult> {
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

function urlOf(result: unknown): string | null {
  return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : null;
}

describe('authGuard', () => {
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideMockStore()] });
    store = TestBed.inject<MockStore<object>>(MockStore);
  });
  // overrideSelector patches the shared selector itself — undo it, or it leaks into later specs.
  afterEach(() => store.resetSelectors());

  it('lets a signed-in tutor through', () => {
    store.overrideSelector(authFeature.selectIsSignedIn, true);
    expect(run(authGuard)).toBeTrue();
  });

  it('redirects a signed-out visitor to /login', () => {
    store.overrideSelector(authFeature.selectIsSignedIn, false);
    expect(urlOf(run(authGuard))).toBe('/login');
  });
});

/** Port of features/onboarding/OnboardingRoute.test.tsx. */
describe('onboardingGuard', () => {
  let isPublished: jasmine.Spy<() => Observable<boolean>>;

  beforeEach(() => {
    isPublished = jasmine.createSpy('isPublished');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ProfileService, useValue: { isPublished } }],
    });
  });

  /** Subscribe and collect what the guard emits. */
  function emitted(result: MaybeAsync<GuardResult>): unknown[] {
    const values: unknown[] = [];
    if (isObservable(result)) result.subscribe((v) => values.push(v));
    return values;
  }

  it('sends a published tutor to the dashboard instead of the wizard', () => {
    isPublished.and.returnValue(of(true));
    expect(emitted(run(onboardingGuard)).map(urlOf)).toEqual(['/dashboard']);
  });

  it('shows the wizard to a tutor who has not published yet', () => {
    isPublished.and.returnValue(of(false));
    expect(emitted(run(onboardingGuard))).toEqual([true]);
  });

  it('decides nothing while the flag is still loading', () => {
    // React rendered `null` here; the router simply waits for the Observable,
    // so neither the wizard nor the dashboard flashes before the answer.
    const pending = new Subject<boolean>();
    isPublished.and.returnValue(pending);
    const values = emitted(run(onboardingGuard));
    expect(values).toEqual([]);

    pending.next(true);
    expect(values.map(urlOf)).toEqual(['/dashboard']);
  });

  it('lets the tutor finish setup when the lookup fails', () => {
    isPublished.and.returnValue(throwError(() => new Error('offline')));
    expect(emitted(run(onboardingGuard))).toEqual([true]);
  });
});
