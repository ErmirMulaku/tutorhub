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
