import type { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import * as bookingsEffects from '../core/bookings/bookings.effects';
import { bookingsFeature } from '../core/bookings/bookings.store';
import * as dashboardEffects from '../core/dashboard/dashboard.effects';
import { dashboardFeature } from '../core/dashboard/dashboard.store';
import { Shell } from './shell';

/**
 * The signed-in part of the app, loaded lazily as one unit (`loadChildren`).
 *
 * The NgRx slices only the shell uses are registered *here*, in the route's
 * providers, instead of in app.config.ts: their reducers, effects and
 * `@ngrx/entity` ship in this lazy chunk, so the login and sign-up pages never
 * download them. They join the root store when this route first activates.
 */
export const SHELL_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    providers: [
      provideState(dashboardFeature),
      provideState(bookingsFeature),
      provideEffects(dashboardEffects, bookingsEffects),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('../features/calendar/calendar-page').then((m) => m.CalendarPage),
      },
      {
        path: 'lessons',
        loadComponent: () => import('../features/lessons/lessons-page').then((m) => m.LessonsPage),
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('../features/messages/messages-page').then((m) => m.MessagesPage),
      },
      {
        path: 'catalog',
        loadComponent: () => import('../features/catalog/catalog-page').then((m) => m.CatalogPage),
      },
      {
        path: 'availability',
        loadComponent: () =>
          import('../features/availability/availability-page').then((m) => m.AvailabilityPage),
      },
      {
        path: 'earnings',
        loadComponent: () =>
          import('../features/earnings/earnings-page').then((m) => m.EarningsPage),
      },
      {
        path: 'marketing',
        loadComponent: () =>
          import('../features/marketing/marketing-page').then((m) => m.MarketingPage),
      },
      {
        path: 'reviews',
        loadComponent: () => import('../features/reviews/reviews-page').then((m) => m.ReviewsPage),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('../features/analytics/analytics-page').then((m) => m.AnalyticsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('../features/settings/settings-page').then((m) => m.SettingsPage),
      },
    ],
  },
];
