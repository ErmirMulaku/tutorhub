import type { Level } from '@ermulaku/types';

/** A subject as returned for listings. */
export interface ClientSubject {
  id: string;
  name: string;
  level: Level;
}

/** A tutor card's worth of data. */
export interface ClientTutor {
  id: string;
  name: string;
  bio: string | null;
  hourlyCents: number;
  rating: number | null;
  timezone: string;
  subjects: ClientSubject[];
}

export interface TutorPage {
  total: number;
  hasMore: boolean;
  items: ClientTutor[];
}

/** A bookable slot (ISO-8601 UTC instants). */
export interface ClientSlot {
  start: string;
  end: string;
}

export interface ListTutorsParams {
  subject?: string;
  level?: Level;
  limit?: number;
  offset?: number;
}

export interface TutorHubClientOptions {
  /** API origin, e.g. `http://localhost:4000`. */
  baseUrl?: string;
  /** Override `fetch` (tests, or environments without a global). */
  fetch?: typeof fetch;
}

/** A GraphQL response carried one or more `errors`. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const TUTORS_QUERY = /* GraphQL */ `
  query Tutors($subject: String, $level: Level, $limit: Int!, $offset: Int!) {
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

const AVAILABILITY_QUERY = /* GraphQL */ `
  query Availability($tutorId: ID!, $date: String!) {
    availability(tutorId: $tutorId, date: $date) {
      start
      end
    }
  }
`;

const BOOK_LESSON_MUTATION = /* GraphQL */ `
  mutation Book($input: BookInput!) {
    bookLesson(input: $input) {
      id
      status
    }
  }
`;

/**
 * Typed TutorHub client shared by the mobile app (and usable anywhere). Reads
 * and booking go over GraphQL; `devLogin` uses REST and stores the JWT for
 * subsequent authenticated calls.
 */
export class TutorHubClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private token: string | null = null;

  constructor(options: TutorHubClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:4000').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Whether a student token has been obtained via {@link devLogin}. */
  get isAuthenticated(): boolean {
    return this.token !== null;
  }

  /** Exchange a student email for a JWT (dev auth) and remember it. */
  async devLogin(email: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new ApiError(`dev-login failed: ${res.status}`);
    const body = (await res.json()) as { accessToken: string };
    this.token = body.accessToken;
  }

  async listTutors(params: ListTutorsParams = {}): Promise<TutorPage> {
    const data = await this.graphql<{ tutors: TutorPage }>(TUTORS_QUERY, {
      subject: params.subject ?? null,
      level: params.level ?? null,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    });
    return data.tutors;
  }

  async getAvailability(tutorId: string, date: string): Promise<ClientSlot[]> {
    const data = await this.graphql<{ availability: ClientSlot[] }>(AVAILABILITY_QUERY, {
      tutorId,
      date,
    });
    return data.availability;
  }

  /** Book a lesson for the logged-in student. Call {@link devLogin} first. */
  async bookLesson(input: {
    tutorId: string;
    subjectId: string;
    startTime: string;
  }): Promise<{ id: string; status: string }> {
    if (!this.token) throw new ApiError('Not authenticated — call devLogin first.');
    const data = await this.graphql<{ bookLesson: { id: string; status: string } }>(
      BOOK_LESSON_MUTATION,
      { input },
    );
    return data.bookLesson;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    const res = await this.fetchImpl(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new ApiError(`GraphQL request failed: ${res.status}`);

    const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new ApiError(body.errors.map((e) => e.message).join('; '));
    if (body.data === undefined) throw new ApiError('GraphQL response contained no data');
    return body.data;
  }
}
