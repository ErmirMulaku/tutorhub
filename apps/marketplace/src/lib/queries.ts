import type { Level } from '@ermulaku/types';
import { graphqlRequest } from './graphql';

/** A subject as returned for storefront listings. */
export interface DiscoverSubject {
  id: string;
  name: string;
  level: Level;
}

/** A tutor card's worth of data from the `tutors` query. */
export interface DiscoverTutor {
  id: string;
  name: string;
  bio: string | null;
  hourlyCents: number;
  rating: number | null;
  timezone: string;
  subjects: DiscoverSubject[];
}

export interface TutorPage {
  total: number;
  hasMore: boolean;
  items: DiscoverTutor[];
}

const TUTORS_QUERY = /* GraphQL */ `
  query Discover($subject: String, $level: Level, $limit: Int!, $offset: Int!) {
    tutors(subject: $subject, level: $level, limit: $limit, offset: $offset) {
      total
      hasMore
      items {
        id
        name
        bio
        hourlyCents
        rating
        timezone
        subjects {
          id
          name
          level
        }
      }
    }
  }
`;

/** A review shown on a tutor profile. */
export interface TutorReview {
  id: string;
  rating: number;
  comment: string | null;
}

/** Full tutor detail for the profile page. */
export interface ProfileTutor extends DiscoverTutor {
  reviews: TutorReview[];
}

/** A bookable time slot from the availability engine (ISO-8601 UTC instants). */
export interface Slot {
  start: string;
  end: string;
}

const TUTOR_QUERY = /* GraphQL */ `
  query Tutor($id: ID!) {
    tutor(id: $id) {
      id
      name
      bio
      hourlyCents
      rating
      timezone
      subjects {
        id
        name
        level
      }
      reviews {
        id
        rating
        comment
      }
    }
  }
`;

const AVAILABILITY_QUERY = /* GraphQL */ `
  query Availability($tutorId: ID!, $date: String!) {
    availability(tutorId: $tutorId, date: $date) {
      start
      end
    }
  }
`;

/** SSR fetch for a single tutor profile; `null` when the id is unknown. */
export async function getTutor(id: string): Promise<ProfileTutor | null> {
  const data = await graphqlRequest<{ tutor: ProfileTutor | null }>(TUTOR_QUERY, {
    variables: { id },
    next: { revalidate: 60 },
  });
  return data.tutor;
}

/** Availability for a tutor on a given `YYYY-MM-DD` date. Always fresh. */
export async function getAvailability(tutorId: string, date: string): Promise<Slot[]> {
  const data = await graphqlRequest<{ availability: Slot[] }>(AVAILABILITY_QUERY, {
    variables: { tutorId, date },
    cache: 'no-store',
  });
  return data.availability;
}

export interface GetTutorsArgs {
  subject?: string | undefined;
  level?: Level | undefined;
  limit?: number;
  offset?: number;
}

/** SSR fetch for the discover grid. Listings revalidate every 60s. */
export async function getTutors({
  subject,
  level,
  limit = 24,
  offset = 0,
}: GetTutorsArgs): Promise<TutorPage> {
  const data = await graphqlRequest<{ tutors: TutorPage }>(TUTORS_QUERY, {
    variables: { subject: subject ?? null, level: level ?? null, limit, offset },
    next: { revalidate: 60 },
  });
  return data.tutors;
}
