import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { API_BASE_URL, authFeature, authInterceptor } from '@ermulaku/dashboard-kit';
import { provideState, provideStore } from '@ngrx/store';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

/**
 * Standalone mode only: the remote opened directly on :3101, for local
 * development. Inside the dashboard none of this runs — the shell loads
 * `REVIEWS_ROUTES` into its own router, store and HttpClient.
 *
 * The auth slice reads its token from this origin's localStorage, which the
 * dashboard (:3100, another origin) never writes — so standalone, the page
 * renders but its API calls are unauthenticated. Hence the banner in app.ts.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    provideStore({}),
    provideState(authFeature),
  ],
};
