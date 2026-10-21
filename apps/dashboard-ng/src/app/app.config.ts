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
import * as uiEffects from './core/ui/ui.effects';
import { uiFeature } from './core/ui/ui.store';

/**
 * App-wide providers — the Angular counterpart of React's
 * `<Provider store={store}><BrowserRouter>` plus `configureStore(...)`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideStore(),
    provideState(authFeature),
    provideState(uiFeature),
    provideEffects(authEffects, uiEffects),
    // Redux DevTools browser extension; read-only outside dev builds.
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ],
};
