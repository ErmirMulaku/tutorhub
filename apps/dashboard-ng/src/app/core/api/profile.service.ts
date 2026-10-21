import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { GraphqlClient } from './graphql-client';
import type { MeTutor, TutorSettings } from './models';

/** The signed-in tutor's identity and settings. Documents copied verbatim from api.ts. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly gql = inject(GraphqlClient);

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
}
