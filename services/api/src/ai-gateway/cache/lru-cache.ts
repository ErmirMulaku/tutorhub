/**
 * Least-recently-used cache with a fixed capacity. A `Map` already keeps
 * keys in insertion order, so "move to most-recently-used" is just
 * delete-then-reinsert, and "evict the oldest" is just deleting the first
 * key the iterator yields.
 */
export class LruCache<K, V> {
  private readonly store = new Map<K, V>();

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error('LruCache capacity must be positive.');
    }
  }

  get(key: K): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.store.delete(key);
    this.store.set(key, value);
    if (this.store.size > this.capacity) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}
