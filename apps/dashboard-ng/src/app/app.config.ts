import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import * as authEffects from './core/auth/auth.effects';
import { authInterceptor } from './core/auth/auth.interceptor';
import { authFeature } from './core/auth/auth.store';
import { resetOnAuthChange } from './core/auth/reset-on-auth-change';
import * as bookingsEffects from './core/bookings/bookings.effects';
import { bookingsFeature } from './core/bookings/bookings.store';
import * as dashboardEffects from './core/dashboard/dashboard.effects';
import { dashboardFeature } from './core/dashboard/dashboard.store';
import * as uiEffects from './core/ui/ui.effects';
import { uiFeature } from './core/ui/ui.store';

/**
 * App-wide providers — the Angular counterpart of React's
 * `<Provider store={store}><BrowserRouter>` plus `configureStore(...)`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: route params and query params (e.g. /lessons?q=)
    // are passed straight into matching component `input()`s.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // The meta-reducer wipes data slices when the signed-in tutor changes.
    provideStore({}, { metaReducers: [resetOnAuthChange] }),
    provideState(authFeature),
    provideState(uiFeature),
    provideState(dashboardFeature),
    provideState(bookingsFeature),
    provideEffects(authEffects, uiEffects, dashboardEffects, bookingsEffects),
    // Redux DevTools browser extension; read-only outside dev builds.
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ],
};
