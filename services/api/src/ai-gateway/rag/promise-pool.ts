/**
 * Runs `worker` over every item, with at most `limit` running concurrently.
 * Results come back in the same order as `items`, regardless of which
 * worker finished first.
 */
export async function promisePool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const queue = items.map((item, index) => ({ item, index }));

  async function runNext(): Promise<void> {
    const next = queue.shift();
    if (next === undefined) {
      return;
    }
    results[next.index] = await worker(next.item, next.index);
    return runNext();
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}
