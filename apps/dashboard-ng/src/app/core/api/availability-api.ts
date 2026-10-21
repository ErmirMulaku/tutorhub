import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type { BookingRules, MyAvailability, TimeOffInput, WorkingHour } from './models';

/** Working hours, booking rules and time off. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class AvailabilityApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  myAvailability(): Observable<MyAvailability> {
    return this.gql
      .request<{
        myAvailability: MyAvailability;
      }>(
        `{ myAvailability { bufferMinutes minNoticeHours maxLessonsPerDay workingHours { day start end } timeOff { id label startDate endDate } } }`,
      )
      .pipe(map((r) => r.myAvailability));
  }

  updateWorkingHours(hours: WorkingHour[]): Observable<void> {
    return this.mutate(
      `mutation($hours: [WorkingHourInput!]!){ updateWorkingHours(hours: $hours){ bufferMinutes } }`,
      { hours: hours.map((h) => ({ day: h.day, start: h.start, end: h.end })) },
    );
  }

  updateBookingRules(rules: BookingRules): Observable<void> {
    return this.mutate(
      `mutation($rules: BookingRulesInput!){ updateBookingRules(rules: $rules){ bufferMinutes } }`,
      { rules },
    );
  }

  addTimeOff(input: TimeOffInput): Observable<void> {
    return this.mutate(
      `mutation($input: TimeOffInput!){ addTimeOff(input: $input){ bufferMinutes } }`,
      { input },
    );
  }

  removeTimeOff(id: string): Observable<void> {
    return this.mutate(`mutation($id: ID!){ removeTimeOff(id: $id){ bufferMinutes } }`, { id });
  }

  /** Every availability mutation invalidates the same single tag. */
  private mutate(document: string, variables: Record<string, unknown>): Observable<void> {
    return this.gql.request(document, variables).pipe(
      map(() => undefined),
      tap(() => this.tags.invalidate('Availability')),
    );
  }
}
