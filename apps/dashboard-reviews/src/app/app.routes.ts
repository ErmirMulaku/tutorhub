import type { Routes } from '@angular/router';
import { REVIEWS_ROUTES } from './reviews.routes';

/** Standalone mode: the exposed routes at /reviews, like in the dashboard. */
export const routes: Routes = [
  { path: 'reviews', children: REVIEWS_ROUTES },
  { path: '**', redirectTo: 'reviews' },
];
