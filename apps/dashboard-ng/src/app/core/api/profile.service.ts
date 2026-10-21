import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type { MeTutor, NotificationPrefsInput, TutorProfileInput, TutorSettings } from './models';

/** The signed-in tutor's identity, settings and account. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  meTutor(): Observable<MeTutor> {
    return this.gql
      .request<{ meTutor: MeTutor }>(`{ meTutor { id name headline } }`)
      .pipe(map((r) => r.meTutor));
  }

  tutorSettings(): Observable<TutorSettings> {
    return this.gql
      .request<{
        tutorSettings: TutorSettings;
      }>(
        `{ tutorSettings { name headline about timezone languages isActive notifyBookings notifyReminders notifyMessages notifyPayouts notifyTips } }`,
      )
      .pipe(map((r) => r.tutorSettings));
  }

  /**
   * Whether onboarding is done. `publishProfile` is the only thing that sets
   * `isActive`, so the flag doubles as "published" (see use-profile-published.ts).
   */
  isPublished(): Observable<boolean> {
    return this.tutorSettings().pipe(map((s) => s.isActive === true));
  }

  updateProfile(input: TutorProfileInput): Observable<void> {
    return this.gql
      .request(
        `mutation($input: UpdateTutorProfileInput!){ updateTutorProfile(input: $input){ name } }`,
        {
          input: {
            name: input.name,
            headline: input.headline,
            about: input.about,
            timezone: input.timezone,
            languages: input.languages,
          },
        },
      )
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Settings', 'MeTutor')),
      );
  }

  updateNotificationPrefs(input: NotificationPrefsInput): Observable<void> {
    return this.gql
      .request(
        `mutation($input: UpdateNotificationPrefsInput!){ updateTutorNotificationPrefs(input: $input){ name } }`,
        { input },
      )
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Settings')),
      );
  }

  publishProfile(): Observable<void> {
    return this.gql.request(`mutation { publishProfile { isActive } }`).pipe(
      map(() => undefined),
      tap(() => this.tags.invalidate('Settings', 'MeTutor')),
    );
  }

  /** Permanently deletes the account. The caller must clear the session after. */
  deleteAccount(): Observable<boolean> {
    return this.gql
      .request<{ deleteTutorAccount: boolean }>(`mutation { deleteTutorAccount }`)
      .pipe(map((r) => r.deleteTutorAccount));
  }
}
