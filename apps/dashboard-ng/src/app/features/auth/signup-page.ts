import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthActions } from '../../core/auth/auth.store';
import { isValidEmail, passwordError } from '../../core/validation';
import { Button } from '../../shared/button';
import { VerifyPanel, type VerifiedSession } from './verify-panel';

/** Port of features/auth/RegisterScreen.tsx. */
@Component({
  selector: 'th-signup-page',
  imports: [ReactiveFormsModule, RouterLink, Button, VerifyPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signup-page.html',
})
export class SignupPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  protected readonly phase = signal<'form' | 'verify'>('form');
  protected readonly devCode = signal<string | null>(null);
  protected readonly demoCode = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** Same checks and messages, in the same order, as the React screen. */
  private validate(): string | null {
    const { fullName, email, password, confirmPassword } = this.form.getRawValue();
    if (fullName.trim() === '') return 'Enter your full name.';
    if (!isValidEmail(email)) return 'Enter a valid email address.';
    const pwErr = passwordError(password);
    if (pwErr) return pwErr;
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  protected signUp(): void {
    const validationError = this.validate();
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    const { fullName, email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.authApi
      .signup(fullName, email, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.busy.set(false);
          const payload = body.data?.tutorSignup;
          if (!payload) {
            this.error.set(body.errors?.[0]?.message ?? 'Sign-up failed.');
            return;
          }
          this.devCode.set(payload.devCode);
          this.demoCode.set(payload.demoCode);
          this.phase.set('verify');
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not reach the server.');
        },
      });
  }

  protected onVerified(session: VerifiedSession): void {
    this.store.dispatch(AuthActions.setCredentials(session));
    // New tutors land in onboarding to complete and publish their profile.
    void this.router.navigateByUrl('/onboarding', { replaceUrl: true });
  }
}
