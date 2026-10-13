import { describe, expect, it } from '@jest/globals';
import type { RedisService } from '../../limits/redis.service.js';
import { ConfirmationService, type StoredConfirmation } from '../confirmation.service.js';

function fakeRedis(): RedisService {
  const store = new Map<string, string>();
  return {
    setex: (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK' as const);
    },
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    del: (key: string) => Promise.resolve(store.delete(key) ? 1 : 0),
  } as unknown as RedisService;
}

const pending: StoredConfirmation = {
  principalKind: 'student',
  principalId: 's1',
  toolName: 'bookLesson',
  args: { tutorId: 't1' },
  summary: 'Book tutor t1?',
};

describe('ConfirmationService', () => {
  it('round-trips a stored confirmation without consuming it on get()', async () => {
    const service = new ConfirmationService(fakeRedis());
    const token = await service.create(pending);

    const first = await service.get(token);
    const second = await service.get(token);

    expect(first).toEqual(pending);
    expect(second).toEqual(pending);
  });

  it('is single-use once invalidate() is called', async () => {
    const service = new ConfirmationService(fakeRedis());
    const token = await service.create(pending);

    await service.invalidate(token);

    expect(await service.get(token)).toBeNull();
  });

  it('returns null for an unknown token', async () => {
    const service = new ConfirmationService(fakeRedis());

    expect(await service.get('not-a-real-token')).toBeNull();
  });

  it('two different tokens do not collide', async () => {
    const service = new ConfirmationService(fakeRedis());
    const tokenA = await service.create(pending);
    const tokenB = await service.create({ ...pending, toolName: 'cancelLesson' });

    await service.invalidate(tokenA);

    expect(await service.get(tokenA)).toBeNull();
    expect(await service.get(tokenB)).toEqual({ ...pending, toolName: 'cancelLesson' });
  });
});
