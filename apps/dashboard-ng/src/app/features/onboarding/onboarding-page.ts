import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/button';

/**
 * /onboarding — outside the shell, behind `authGuard` + `onboardingGuard`
 * (published tutors are sent to /dashboard). The 6-step wizard is ported in
 * Phase 5, once the catalog, availability and payout editors it embeds exist.
 */
@Component({
  selector: 'th-onboarding-page',
  imports: [RouterLink, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login">
      <div class="login__panel">
        <div class="login__brand">Tutor<strong>Hub</strong></div>
        <h1 class="login__title">Let's get your profile ready</h1>
        <p class="login__subtitle">
          The onboarding wizard is ported in Phase 5 of the Angular migration.
        </p>
        <a th-button routerLink="/dashboard" block>Go to the dashboard</a>
      </div>
    </div>
  `,
})
export class OnboardingPage {}
