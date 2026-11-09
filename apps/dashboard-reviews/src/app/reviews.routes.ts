import type { Routes } from '@angular/router';
import { ReviewsPage } from './reviews-page';

/**
 * What this remote exposes (federation.config.mjs → './routes'). The dashboard
 * mounts it with `loadChildren` under /reviews, so the remote owns everything
 * below that path. No providers here on purpose: inside the dashboard the page
 * runs in the shell's injector — its router, HttpClient, auth interceptor and
 * NgRx store — through the shared singletons.
 */
export const REVIEWS_ROUTES: Routes = [{ path: '', component: ReviewsPage }];
