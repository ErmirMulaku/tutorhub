import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { Level } from '@ermulaku/types';
import { filter, finalize, take } from 'rxjs';
import { cachedQuery } from '../../core/api/cache-tags';
import { CatalogApi } from '../../core/api/catalog-api';
import { errorMessage } from '../../core/api/errors';
import { ProfileService } from '../../core/api/profile.service';
import { money } from '../../core/format';
import { Button } from '../../shared/button';
import { FieldError } from '../../shared/field-error';
import { WeeklyHoursEditor } from '../availability/weekly-hours-editor';
import { NewServiceModal } from '../catalog/new-service-modal';
import { PayoutEditor } from '../earnings/payout-editor';

const STEPS = ['Welcome', 'Profile', 'Subjects', 'Availability', 'Payout', 'Publish'] as const;

/** Avatar tints cycled across the subject cards, keyed to design-system tokens. */
const SUBJECT_TINTS = ['teal', 'accent', 'blue', 'green'] as const;

const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

/**
 * Port of features/onboarding/OnboardingWizard.tsx — a 6-step setup that ends
 * by publishing the profile. Reached via /onboarding, which `onboardingGuard`
 * only lets an unpublished tutor into.
 */
@Component({
  selector: 'th-onboarding-page',
  imports: [
    ReactiveFormsModule,
    Button,
    FieldError,
    NewServiceModal,
    PayoutEditor,
    WeeklyHoursEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-page.html',
})
export class OnboardingPage {
  private readonly router = inject(Router);
  private readonly profileApi = inject(ProfileService);
  private readonly catalogApi = inject(CatalogApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps = STEPS;
  protected readonly step = signal(1);
  protected readonly stepState = computed(() =>
    STEPS.map((label, i) => {
      const n = i + 1;
      const state = n < this.step() ? 'done' : n === this.step() ? 'current' : 'upcoming';
      return { label, n, state };
    }),
  );

  private readonly settings = cachedQuery({
    tags: ['Settings'],
    load: () => this.profileApi.tutorSettings(),
  });
  protected readonly services = cachedQuery({
    tags: ['Service'],
    load: () => this.catalogApi.myServices(),
  });

  protected readonly profile = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    headline: ['', Validators.maxLength(120)],
    about: [''],
  });
  protected readonly firstName = signal('there');
  protected readonly addSubjectOpen = signal(false);
  protected readonly publishing = signal(false);
  protected readonly publishError = signal<string | null>(null);

  protected readonly money = money;
  protected readonly levelLabel = LEVEL_LABEL;

  constructor() {
    // Prefill from the saved settings once (React: "if settings && name === ''").
    toObservable(this.settings.data)
      .pipe(
        filter((s) => s !== undefined),
        take(1),
        takeUntilDestroyed(),
      )
      .subscribe((s) =>
        this.profile.reset({ name: s.name, headline: s.headline ?? '', about: s.about ?? '' }),
      );
  }

  protected tint(index: number): string {
    return SUBJECT_TINTS[index % SUBJECT_TINTS.length] ?? 'teal';
  }

  protected back(): void {
    this.step.update((s) => s - 1);
  }

  protected next(): void {
    if (this.step() === 2) {
      if (this.profile.invalid) {
        this.profile.markAllAsTouched();
        return;
      }
      const value = this.profile.getRawValue();
      this.firstName.set(value.name.split(' ')[0] || 'there');
      // Saved in the background, as in React; publishing re-checks everything.
      this.profileApi.updateProfile(value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
    if (this.step() < STEPS.length) this.step.update((s) => s + 1);
  }

  protected finish(): void {
    this.publishError.set(null);
    this.publishing.set(true);
    this.profileApi
      .publishProfile()
      .pipe(
        finalize(() => this.publishing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/dashboard', { replaceUrl: true }),
        // The API refuses to publish without a live service, subject or
        // availability, and says which are missing — show that, don't go quiet.
        error: (err: unknown) =>
          this.publishError.set(errorMessage(err, 'Could not publish your profile.')),
      });
  }

  protected close(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
