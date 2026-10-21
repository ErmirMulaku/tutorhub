import type { Routes } from '@angular/router';
import { authGuard, onboardingGuard } from './core/auth/auth.guards';

/**
 * Port of App.tsx's <Routes>. Nothing here is imported eagerly: each page is a
 * `loadComponent`, and the whole signed-in area is one `loadChildren`
 * (layout/shell.routes.ts) carrying its own NgRx slices.
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
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./layout/shell.routes').then((m) => m.SHELL_ROUTES),
  },
  { path: '**', redirectTo: 'dashboard' },
];
