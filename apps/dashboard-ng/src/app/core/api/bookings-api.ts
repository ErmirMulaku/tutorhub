import { Injectable, inject } from '@angular/core';
import type { BookingStatus } from '@ermulaku/types';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type {
  CreateLessonInput,
  StudentRef,
  SubjectRef,
  TutorBooking,
  TutorBookingsQuery,
} from './models';

/** Reusable GraphQL selection for a tutor-facing booking (same as api.ts). */
const BOOKING_FIELDS = `
  id startTime endTime status
  student { id fullName avatarColor }
  subject { id name level }
`;

/** Status transitions a tutor can make on a booking. */
export type BookingTransition = 'accept' | 'decline' | 'complete';

const TRANSITION_MUTATION: Record<BookingTransition, string> = {
  accept: 'acceptBooking',
  decline: 'declineBooking',
  complete: 'completeBooking',
};

/** Bookings, lessons and the New-lesson pickers. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class BookingsApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  todaySchedule(): Observable<TutorBooking[]> {
    return this.gql
      .request<{ todaySchedule: TutorBooking[] }>(`{ todaySchedule { ${BOOKING_FIELDS} } }`)
      .pipe(map((r) => r.todaySchedule));
  }

  tutorBookings(args: TutorBookingsQuery = {}): Observable<TutorBooking[]> {
    return this.gql
      .request<{ tutorBookings: TutorBooking[] }>(
        `query($status: BookingStatus, $from: String, $to: String) {
            tutorBookings(status: $status, from: $from, to: $to) { ${BOOKING_FIELDS} }
          }`,
        { status: args.status, from: args.from, to: args.to },
      )
      .pipe(map((r) => r.tutorBookings));
  }

  /** accept / decline / complete — one mutation each, same invalidation. */
  transition(
    id: string,
    transition: BookingTransition,
  ): Observable<{ id: string; status: BookingStatus }> {
    const field = TRANSITION_MUTATION[transition];
    return this.gql
      .request<
        Record<string, { id: string; status: BookingStatus }>
      >(`mutation($id: ID!){ ${field}(id: $id){ id status } }`, { id })
      .pipe(
        map((r) => {
          const result = r[field];
          if (!result) throw new Error(`Missing ${field} in response`);
          return result;
        }),
        tap(() => this.tags.invalidate('Booking', 'DashboardSummary', 'Notifications')),
      );
  }

  createLesson(input: CreateLessonInput): Observable<{ id: string }> {
    return this.gql
      .request<{
        createLesson: { id: string };
      }>(
        `mutation($s: ID!, $sub: ID!, $t: String!){ createLesson(studentId: $s, subjectId: $sub, startTime: $t){ id } }`,
        { s: input.studentId, sub: input.subjectId, t: input.startTime },
      )
      .pipe(
        map((r) => r.createLesson),
        tap(() => this.tags.invalidate('Booking', 'DashboardSummary', 'Notifications')),
      );
  }

  myStudents(): Observable<StudentRef[]> {
    return this.gql
      .request<{ myStudents: StudentRef[] }>(`{ myStudents { id fullName avatarColor } }`)
      .pipe(map((r) => r.myStudents));
  }

  mySubjects(): Observable<SubjectRef[]> {
    return this.gql
      .request<{ mySubjects: SubjectRef[] }>(`{ mySubjects { id name level } }`)
      .pipe(map((r) => r.mySubjects));
  }
}
