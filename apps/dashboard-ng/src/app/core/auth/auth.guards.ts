import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { catchError, map, of } from 'rxjs';
import { ProfileService } from '../api/profile.service';
import { authFeature } from './auth.store';

/**
 * Port of AppShell's `if (token === null) return <Navigate to="/login" />`:
 * no session → redirect. Returning a UrlTree (not calling navigate) lets the
 * router cancel this navigation and start the redirect in one step.
 */
export const authGuard: CanActivateFn = () => {
  const signedIn = inject(Store).selectSignal(authFeature.selectIsSignedIn)();
  return signedIn || inject(Router).createUrlTree(['/login']);
};

/**
 * Port of OnboardingRoute: onboarding runs once, so a published tutor goes to
 * the dashboard instead. The router waits for the Observable, so nothing
 * renders while the flag loads (React rendered `null` for the same reason).
 * A failed lookup counts as not published, so an error can never lock a tutor
 * out of finishing setup.
 */
export const onboardingGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(ProfileService)
    .isPublished()
    .pipe(
      map((published) => (published ? router.createUrlTree(['/dashboard']) : true)),
      catchError(() => of(true)),
    );
};
