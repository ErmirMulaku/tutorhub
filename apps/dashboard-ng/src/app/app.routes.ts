import type { Routes } from '@angular/router';
import { authGuard, onboardingGuard } from './core/auth/auth.guards';

/**
 * Port of App.tsx's <Routes>. Every screen is `loadComponent`, so the bundler
 * splits each into its own chunk, downloaded the first time the route is
 * visited (React imported them all eagerly into one bundle).
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup-page').then((m) => m.SignupPage),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding-page').then((m) => m.OnboardingPage),
  },
  {
    // Layout route: the shell renders, its <router-outlet> renders the child.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar-page').then((m) => m.CalendarPage),
      },
      {
        path: 'lessons',
        loadComponent: () => import('./features/lessons/lessons-page').then((m) => m.LessonsPage),
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/messages/messages-page').then((m) => m.MessagesPage),
      },
      {
        path: 'catalog',
        loadComponent: () => import('./features/catalog/catalog-page').then((m) => m.CatalogPage),
      },
      {
        path: 'availability',
        loadComponent: () =>
          import('./features/availability/availability-page').then((m) => m.AvailabilityPage),
      },
      {
        path: 'earnings',
        loadComponent: () =>
          import('./features/earnings/earnings-page').then((m) => m.EarningsPage),
      },
      {
        path: 'marketing',
        loadComponent: () =>
          import('./features/marketing/marketing-page').then((m) => m.MarketingPage),
      },
      {
        path: 'reviews',
        loadComponent: () => import('./features/reviews/reviews-page').then((m) => m.ReviewsPage),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics-page').then((m) => m.AnalyticsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
