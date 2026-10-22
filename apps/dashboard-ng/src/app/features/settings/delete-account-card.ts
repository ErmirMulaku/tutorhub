import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { finalize } from 'rxjs';
import { ProfileService } from '../../core/api/profile.service';
import { AuthActions } from '../../core/auth/auth.store';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';

/**
 * Port of features/settings/DeleteAccountCard.tsx — permanent account deletion.
 *
 * Deliberately awkward: it removes lessons students already took and the
 * records of what they paid, and none of it can be restored. Retyping the
 * account name makes it a decision rather than a misclick.
 *
 * The check is a `computed`, not a form validator: a FormControl runs its
 * validators in its constructor, i.e. during field initialisation, before the
 * required `name` input exists (Angular throws NG0950 if you read it then).
 * As a computed it reads `name()` only when the template asks, and it stays
 * correct if the name input ever changes.
 */
@Component({
  selector: 'th-delete-account-card',
  imports: [ReactiveFormsModule, Button, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-account-card.html',
})
export class DeleteAccountCard {
  private readonly profile = inject(ProfileService);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);

  /** The account's saved name, retyped to confirm. */
  readonly name = input.required<string>();

  protected readonly open = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirm = inject(NonNullableFormBuilder).control('');
  private readonly typed = toSignal(this.confirm.valueChanges, { initialValue: '' });
  protected readonly matches = computed(() => {
    const expected = this.name().trim();
    return expected !== '' && this.typed().trim() === expected;
  });

  protected cancel(): void {
    this.open.set(false);
    this.confirm.reset();
  }

  protected remove(): void {
    if (!this.matches()) return;
    this.error.set(null);
    this.deleting.set(true);
    this.profile
      .deleteAccount()
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        // The tutor no longer exists: drop the session before anything can
        // refetch with its token. The auth effect navigates to /login.
        next: () => this.store.dispatch(AuthActions.clearCredentials()),
        error: () => this.error.set('Could not delete your account. Nothing was changed.'),
      });
  }
}
