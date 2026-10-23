import { describe, expect, it, jest } from '@jest/globals';
import { withRetry } from './retry.js';

const retryAll = { attempts: 3, baseMs: 0, isRetryable: (): boolean => true };

describe('withRetry', () => {
  it('retries a retryable failure and returns the later success', async () => {
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, retryAll)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops at the first non-retryable failure', async () => {
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('card declined'));
    await expect(withRetry(fn, { ...retryAll, isRetryable: () => false })).rejects.toThrow(
      'card declined',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last attempt', async () => {
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('down'));
    await expect(withRetry(fn, retryAll)).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
