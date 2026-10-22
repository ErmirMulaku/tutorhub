import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthApiService, isEmailNotVerified } from '../../core/auth/auth-api.service';
import { AuthActions } from '../../core/auth/auth.store';
import { isValidEmail } from '../../core/validation';
import { Button } from '../../shared/button';
import { VerifyPanel, type VerifiedSession } from './verify-panel';

const SEED_EMAIL = 'lena@tutor.example.com';

/** Port of features/auth/LoginScreen.tsx. */
@Component({
  selector: 'th-login-page',
  imports: [ReactiveFormsModule, RouterLink, Button, VerifyPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);

  // A typed reactive form; `nonNullable` means reset() goes back to these
  // seed values instead of null. Prefilled with the seed tutor, like React.
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: SEED_EMAIL,
    password: 'password123',
  });
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Set when the password was right but the address was never verified. */
  protected readonly unverified = signal(false);

  protected signIn(): void {
    const { email, password } = this.form.getRawValue();
    if (!isValidEmail(email)) {
      this.error.set('Enter a valid email address.');
      return;
    }
    if (password === '') {
      this.error.set('Enter your password.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.authApi
      .signin(email, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.busy.set(false);
          const payload = body.data?.tutorSignin;
          if (!payload) {
            // Credentials were right, the address just wasn't verified — go to
            // the code step rather than repeating "sign-in failed" forever.
            if (isEmailNotVerified(body.errors)) {
              this.unverified.set(true);
              return;
            }
            this.error.set(body.errors?.[0]?.message ?? 'Sign-in failed.');
            return;
          }
          this.onAuthenticated({ token: payload.accessToken, tutorId: payload.tutorId });
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not reach the server.');
        },
      });
  }

  protected onAuthenticated(session: VerifiedSession): void {
    this.store.dispatch(AuthActions.setCredentials(session));
    void this.router.navigateByUrl('/dashboard', { replaceUrl: true });
  }
}
