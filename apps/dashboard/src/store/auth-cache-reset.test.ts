import { describe, expect, it } from '@jest/globals';
import { api } from './api';
import { clearCredentials, setCredentials } from './auth-slice';
import { store } from './store';

/** Seed the cache the way a signed-in session would, without hitting the network. */
async function seedCachedIdentity(name: string): Promise<void> {
  await store.dispatch(
    api.util.upsertQueryData('getMeTutor', undefined, { id: 't1', name, headline: null }),
  );
}

function cachedNames(): unknown[] {
  return Object.values(store.getState().api.queries)
    .map((entry) => (entry?.data as { name?: string } | undefined)?.name)
    .filter((n) => n !== undefined);
}

describe('signed-in tutor changes', () => {
  it('drops the previous account cache when a new tutor signs in', async () => {
    await seedCachedIdentity('New Acc');
    expect(cachedNames()).toContain('New Acc');

    store.dispatch(setCredentials({ token: 'token-b', tutorId: 't2' }));

    // Otherwise the next account renders "New Acc" until each query refetches.
    expect(cachedNames()).toHaveLength(0);
  });

  it('drops the cache on sign-out', async () => {
    await seedCachedIdentity('New Acc');
    expect(cachedNames()).toContain('New Acc');

    store.dispatch(clearCredentials());

    expect(cachedNames()).toHaveLength(0);
  });
});
