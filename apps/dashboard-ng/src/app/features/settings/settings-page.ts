import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { type Observable, catchError, concatMap, filter, finalize, map, of } from 'rxjs';
import { cachedQuery } from '../../core/api/cache-tags';
import { EarningsApi } from '../../core/api/earnings-api';
import { errorMessage } from '../../core/api/errors';
import type { NotificationPrefsInput, PayoutSchedule } from '../../core/api/models';
import { ProfileService } from '../../core/api/profile.service';
import { ianaTimezone } from '../../core/validators';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { FieldError } from '../../shared/field-error';
import { type Segment, SegmentedTabs } from '../../shared/segmented-tabs';
import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../shared/toast';
import { ToggleSwitch } from '../../shared/toggle-switch';
import { PAYOUT_SCHEDULES, scheduleLabel } from '../earnings/payout-editor';
import { DeleteAccountCard } from './delete-account-card';

type Tab = 'profile' | 'payout' | 'notifications';
type NotifyKey = keyof NotificationPrefsInput;

const NOTIFY_ROWS: { key: NotifyKey; title: string; subtitle: string }[] = [
  {
    key: 'notifyBookings',
    title: 'New booking requests',
    subtitle: 'When a student requests a lesson',
  },
  { key: 'notifyReminders', title: 'Lesson reminders', subtitle: 'Before each upcoming lesson' },
  { key: 'notifyMessages', title: 'New messages', subtitle: 'When a student messages you' },
  { key: 'notifyPayouts', title: 'Payouts & earnings', subtitle: 'When a payout is sent' },
  { key: 'notifyTips', title: 'Tips & product news', subtitle: 'Occasional updates from TutorHub' },
];

/** Port of features/settings/SettingsScreen.tsx — Profile / Payout / Notifications. */
@Component({
  selector: 'th-settings-page',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    DeleteAccountCard,
    ErrorState,
    FieldError,
    SegmentedTabs,
    Skeleton,
    ToggleSwitch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly profileApi = inject(ProfileService);
  private readonly earningsApi = inject(EarningsApi);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tab = signal<Tab>('profile');
  protected readonly tabs: Segment<Tab>[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'payout', label: 'Payout' },
    { key: 'notifications', label: 'Notifications' },
  ];
  protected readonly notifyRows = NOTIFY_ROWS;
  protected readonly schedules = PAYOUT_SCHEDULES;
  protected readonly scheduleLabel = scheduleLabel;

  protected readonly settings = cachedQuery({
    tags: ['Settings'],
    load: () => this.profileApi.tutorSettings(),
  });
  protected readonly earnings = cachedQuery({
    tags: ['Earnings'],
    load: () => this.earningsApi.summary(),
  });

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly profile = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    headline: ['', Validators.maxLength(120)],
    about: [''],
    timezone: ['', [Validators.required, ianaTimezone]],
  });
  protected readonly savingProfile = signal(false);
  /** One control per preference; a change saves that single preference. */
  protected readonly notifications = this.fb.group({
    notifyBookings: false,
    notifyReminders: false,
    notifyMessages: false,
    notifyPayouts: false,
    notifyTips: false,
  });

  constructor() {
    toObservable(this.settings.data)
      .pipe(
        filter((s) => s !== undefined),
        takeUntilDestroyed(),
      )
      .subscribe((s) => {
        this.profile.reset({
          name: s.name,
          headline: s.headline ?? '',
          about: s.about ?? '',
          timezone: s.timezone,
        });
        // emitEvent: false — loading server values must not trigger a save.
        this.notifications.reset(
          {
            notifyBookings: s.notifyBookings,
            notifyReminders: s.notifyReminders,
            notifyMessages: s.notifyMessages,
            notifyPayouts: s.notifyPayouts,
            notifyTips: s.notifyTips,
          },
          { emitEvent: false },
        );
      });

    // Optimistic toggles: the switch flips at once and the change is saved; if
    // the save fails, the control is put back (without re-triggering a save).
    // concatMap keeps saves in click order, so rapid toggles can't race.
    for (const row of NOTIFY_ROWS) {
      const control = this.notifications.controls[row.key];
      control.valueChanges
        .pipe(
          map((checked) => ({ key: row.key, checked })),
          concatMap(({ key, checked }) =>
            this.profileApi.updateNotificationPrefs({ [key]: checked }).pipe(
              map(() => ({ ok: true as const })),
              // Errors are handled per request so the stream keeps working.
              catchError((err: unknown) => of({ ok: false as const, err, checked })),
            ),
          ),
          takeUntilDestroyed(),
        )
        .subscribe((result) => {
          if (result.ok) {
            this.toast.show('Preferences saved');
          } else {
            control.setValue(!result.checked, { emitEvent: false });
            this.toast.show(`Could not save: ${errorMessage(result.err)}`);
          }
        });
    }
  }

  protected saveProfile(): void {
    if (this.profile.invalid) {
      this.profile.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    this.run(
      this.profileApi
        .updateProfile(this.profile.getRawValue())
        .pipe(finalize(() => this.savingProfile.set(false))),
      'Profile saved',
    );
  }

  protected setSchedule(schedule: PayoutSchedule): void {
    this.run(this.earningsApi.setPayoutSchedule(schedule), 'Payout schedule updated');
  }

  private run(request: Observable<void>, success: string): void {
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.toast.show(success),
      error: (err: unknown) => this.toast.show(`Could not save: ${errorMessage(err)}`),
    });
  }
}
