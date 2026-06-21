import { describe, expect, it } from '@jest/globals';
import { ApiError, TutorHubClient } from '../client.js';

interface Recorded {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fake `fetch` that records calls and replies from a url→body map. */
function fakeFetch(routes: Record<string, unknown>, recorded: Recorded[]): typeof fetch {
  return (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body: unknown = init?.body ? JSON.parse(init.body as string) : undefined;
    recorded.push({ url, headers, body });
    const key = Object.keys(routes).find((k) => url.endsWith(k)) ?? '';
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(routes[key]),
    } as Response);
  };
}

describe('TutorHubClient', () => {
  it('lists tutors via GraphQL', async () => {
    const calls: Recorded[] = [];
    const client = new TutorHubClient({
      baseUrl: 'http://api.test',
      fetch: fakeFetch(
        {
          '/graphql': {
            data: { tutors: { total: 1, hasMore: false, items: [{ id: 't1', name: 'Ada' }] } },
          },
        },
        calls,
      ),
    });

    const page = await client.listTutors({ subject: 'math' });
    expect(page.total).toBe(1);
    expect(page.items[0]?.name).toBe('Ada');
    expect(calls[0]?.url).toBe('http://api.test/graphql');
  });

  it('stores the token from devLogin and sends it on later calls', async () => {
    const calls: Recorded[] = [];
    const client = new TutorHubClient({
      baseUrl: 'http://api.test',
      fetch: fakeFetch(
        {
          '/auth/dev-login': { accessToken: 'tok-123' },
          '/graphql': { data: { bookLesson: { id: 'b1', status: 'PENDING' } } },
        },
        calls,
      ),
    });

    expect(client.isAuthenticated).toBe(false);
    await client.devLogin('sara@example.com');
    expect(client.isAuthenticated).toBe(true);

    const booking = await client.bookLesson({ tutorId: 't1', subjectId: 's1', startTime: 'x' });
    expect(booking).toEqual({ id: 'b1', status: 'PENDING' });

    const graphqlCall = calls.find((c) => c.url.endsWith('/graphql'));
    expect(graphqlCall?.headers['authorization']).toBe('Bearer tok-123');
  });

  it('refuses to book before authenticating', async () => {
    const client = new TutorHubClient({ baseUrl: 'http://api.test', fetch: fakeFetch({}, []) });
    await expect(
      client.bookLesson({ tutorId: 't1', subjectId: 's1', startTime: 'x' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('surfaces GraphQL errors as ApiError', async () => {
    const client = new TutorHubClient({
      baseUrl: 'http://api.test',
      fetch: fakeFetch({ '/graphql': { errors: [{ message: 'Tutor not found' }] } }, []),
    });
    await expect(client.getAvailability('t1', '2026-06-22')).rejects.toThrow('Tutor not found');
  });
});
