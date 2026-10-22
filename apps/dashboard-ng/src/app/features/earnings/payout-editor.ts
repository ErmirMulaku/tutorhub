import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { type Observable, filter, finalize } from 'rxjs';
import { cachedQuery } from '../../core/api/cache-tags';
import { EarningsApi } from '../../core/api/earnings-api';
import { errorMessage } from '../../core/api/errors';
import type { PayoutSchedule } from '../../core/api/models';
import { Button } from '../../shared/button';
import { FieldError } from '../../shared/field-error';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';

export const PAYOUT_SCHEDULES: readonly PayoutSchedule[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

/** "WEEKLY" → "Weekly". */
export function scheduleLabel(s: PayoutSchedule): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Stripe Connect status + call-to-action (port of PayoutEditor.tsx's ConnectPayouts). */
@Component({
  selector: 'th-connect-payouts',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'payout-editor__connect' },
  template: `
    @if (connect.data()?.payoutsEnabled) {
      <span class="th-pill th-pill--info">Payouts enabled via Stripe</span>
    } @else {
      <button th-button size="sm" variant="secondary" [disabled]="linking()" (click)="onConnect()">
        {{
          linking()
            ? 'Opening Stripe…'
            : connect.data()?.onboarded
              ? 'Finish payout setup (Stripe)'
              : 'Connect payouts with Stripe'
        }}
      </button>
      <span class="muted payout-editor__connect-hint">
        Secure onboarding hosted by Stripe — takes ~2 minutes.
      </span>
    }
  `,
})
export class ConnectPayouts {
  private readonly api = inject(EarningsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly connect = cachedQuery({
    tags: ['Earnings'],
    load: () => this.api.connectStatus(),
  });
  protected readonly linking = signal(false);

  protected onConnect(): void {
    this.linking.set(true);
    this.api
      .startConnectOnboarding()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Hosted Stripe onboarding; Stripe redirects back to /earnings when done.
        next: ({ url }) => this.document.location.assign(url),
        error: () => {
          this.linking.set(false);
          this.toast.show('Could not start payout onboarding — is Stripe configured?');
        },
      });
  }
}

/**
 * Link a payout method + pick a payout schedule (port of PayoutEditor.tsx).
 * Used by the onboarding wizard; saving invalidates `Earnings` (+ `Settings`).
 */
@Component({
  selector: 'th-payout-editor',
  imports: [ReactiveFormsModule, Button, ConnectPayouts, FieldError, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The <form> exists for Enter-to-submit only; `display: contents` keeps its
  // children in .payout-editor's flex column, exactly where React put them.
  styles: 'form { display: contents; }',
  template: `
    @if (summary.data(); as data) {
      <div class="payout-editor">
        <th-connect-payouts />
        <form (ngSubmit)="saveMethod()">
          <label class="login__field">
            <span>Payout method</span>
            <input [formControl]="method" placeholder="e.g. Visa •••• 4242" />
            <th-field-error [control]="method" />
          </label>
          <button th-button size="sm" type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save payout method' }}
          </button>
        </form>

        <div class="payout-editor__schedule">
          <span class="login__field"><span>Payout schedule</span></span>
          <div class="settings__schedule">
            @for (s of schedules; track s) {
              <button
                type="button"
                class="settings__sched"
                [class.settings__sched--active]="data.payoutSchedule === s"
                (click)="setSchedule(s)"
              >
                {{ label(s) }}
              </button>
            }
          </div>
        </div>
      </div>
    } @else {
      <th-skeleton [height]="200" />
    }
  `,
})
export class PayoutEditor {
  private readonly api = inject(EarningsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly summary = cachedQuery({
    tags: ['Earnings'],
    load: () => this.api.summary(),
  });
  protected readonly method = inject(NonNullableFormBuilder).control('', [
    Validators.required,
    Validators.pattern(/\S/),
  ]);
  protected readonly saving = signal(false);
  protected readonly schedules = PAYOUT_SCHEDULES;
  protected readonly label = scheduleLabel;

  constructor() {
    toObservable(this.summary.data)
      .pipe(
        filter((data) => data !== undefined),
        takeUntilDestroyed(),
      )
      .subscribe((data) => this.method.reset(data.payoutMethod ?? ''));
  }

  protected saveMethod(): void {
    if (this.method.invalid) {
      this.method.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.run(
      this.api
        .setPayoutMethod(this.method.value.trim())
        .pipe(finalize(() => this.saving.set(false))),
      'Payout method saved',
    );
  }

  protected setSchedule(schedule: PayoutSchedule): void {
    this.run(this.api.setPayoutSchedule(schedule), 'Payout schedule updated');
  }

  private run(request: Observable<void>, success: string): void {
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.toast.show(success),
      error: (err: unknown) => this.toast.show(`Could not save: ${errorMessage(err)}`),
    });
  }
}
