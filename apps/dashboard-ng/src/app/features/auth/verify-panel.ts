import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { Button } from '../../shared/button';

export interface VerifiedSession {
  token: string;
  tutorId: string;
}

/**
 * Port of features/auth/VerifyPanel.tsx — the 6-digit email verification step,
 * shared by sign-up and by sign-in for an unverified account.
 *
 * React props → `input()`s, the `onVerified` callback → an `output()`, and the
 * `subtitle` JSX prop → content projection (`<ng-content />`).
 */
@Component({
  selector: 'th-verify-panel',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // React rendered a fragment straight into .login__panel; `display: contents`
  // makes this host element invisible to layout so the result is the same.
  host: { style: 'display: contents' },
  templateUrl: './verify-panel.html',
})
export class VerifyPanel {
  private readonly authApi = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = input.required<string>();
  /** A code to display when the API has no email transport (local dev only). */
  readonly initialDevCode = input<string | null>(null);
  /** A fixed code this deployment accepts from anyone — shown as a demo shortcut. */
  readonly initialDemoCode = input<string | null>(null);
  readonly verified = output<VerifiedSession>();

  protected readonly code = signal('');
  // Starts from the input, but stays writable (a resend replaces it) — the
  // Angular equivalent of `useState(initialDevCode)`.
  protected readonly devCode = linkedSignal(() => this.initialDevCode());
  protected readonly demoCode = linkedSignal(() => this.initialDemoCode());
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);

  private readonly codeInput = viewChild.required<ElementRef<HTMLInputElement>>('codeInput');

  constructor() {
    // React's autoFocus focuses on mount; the HTML attribute only works on page load.
    afterNextRender(() => this.codeInput().nativeElement.focus());
  }

  /** Digits only, as the user types (React stripped them in onChange). */
  protected onCodeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    el.value = digits;
    this.code.set(digits);
  }

  protected verify(event: Event): void {
    event.preventDefault();
    if (this.code().trim().length !== 6) {
      this.error.set('Enter the 6-digit code from your email.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.authApi
      .verifyEmail(this.email(), this.code().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.busy.set(false);
          const payload = body.data?.tutorVerifyEmail;
          if (!payload) {
            this.error.set(body.errors?.[0]?.message ?? 'That code is invalid or has expired.');
            return;
          }
          this.verified.emit({ token: payload.accessToken, tutorId: payload.tutorId });
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not reach the server.');
        },
      });
  }

  protected resend(): void {
    this.busy.set(true);
    this.error.set(null);
    this.authApi
      .resendCode(this.email())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.busy.set(false);
          this.devCode.set(body.data?.resendTutorVerificationCode?.devCode ?? null);
          this.demoCode.set(body.data?.resendTutorVerificationCode?.demoCode ?? null);
          this.sent.set(true);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Could not reach the server.');
        },
      });
  }
}
