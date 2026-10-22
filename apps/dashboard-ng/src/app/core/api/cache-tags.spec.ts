import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';
import { UiActions } from '../ui/ui.store';
import { CacheTags, cachedQuery, loadOnTags } from './cache-tags';

describe('CacheTags', () => {
  it('emits only for the tags a listener asked about', () => {
    const tags = TestBed.inject(CacheTags);
    const hits: unknown[] = [];
    tags.changes(['Earnings']).subscribe((h) => hits.push(h));

    tags.invalidate('Booking');
    tags.invalidate('Earnings', 'Notifications');
    tags.invalidateAll(); // an account switch reaches everyone

    expect(hits).toEqual([['Earnings', 'Notifications'], 'all']);
  });
});

/** A screen using one component-scoped query, as the feature pages do. */
@Component({ template: '{{ query.data() }}' })
class QueryHost {
  readonly response = new Subject<string>();
  readonly enabled = signal(true);
  loads = 0;
  readonly query = cachedQuery({
    tags: ['Earnings'],
    params: () => (this.enabled() ? true : undefined),
    load: () => {
      this.loads++;
      return this.response;
    },
  });
}

describe('cachedQuery (the RTK Query hook stand-in)', () => {
  /*
   * A loading resource is a *pending task*, so `whenStable()` waits until its
   * data arrives (that's how SSR waits for data, too). While the fake request
   * is still open, `TestBed.tick()` runs change detection and effects instead;
   * `whenStable()` is only awaited once the request has answered.
   */
  function create(): { host: QueryHost; settled: () => Promise<void> } {
    const fixture = TestBed.createComponent(QueryHost);
    TestBed.tick();
    return { host: fixture.componentInstance, settled: () => fixture.whenStable() };
  }

  it('loads once on creation; only the first load counts as isLoading', async () => {
    const { host, settled } = create();
    expect(host.loads).toBe(1);
    expect(host.query.isLoading()).toBeTrue();

    host.response.next('$374');
    await settled();
    expect(host.query.data()).toBe('$374');
    expect(host.query.isLoading()).toBeFalse();
  });

  it('reloads when its tag is invalidated, keeping the old value meanwhile', async () => {
    const { host, settled } = create();
    host.response.next('$374');
    await settled();

    TestBed.inject(CacheTags).invalidate('Booking'); // not ours
    TestBed.tick();
    expect(host.loads).toBe(1);

    TestBed.inject(CacheTags).invalidate('Earnings');
    TestBed.tick();
    expect(host.loads).toBe(2);
    expect(host.query.data()).toBe('$374'); // like RTK's isFetching: old data stays
    expect(host.query.isLoading()).toBeFalse();

    host.response.next('$0');
    await settled();
    expect(host.query.data()).toBe('$0');
  });

  it('fetches nothing while params is undefined (RTK `skip`)', async () => {
    const fixture = TestBed.createComponent(QueryHost);
    fixture.componentInstance.enabled.set(false);
    await fixture.whenStable();
    expect(fixture.componentInstance.loads).toBe(0);
  });

  it('exposes a failure as error() without throwing from data()', async () => {
    const fixture = TestBed.createComponent(QueryHost);
    fixture.componentInstance.response.error(new Error('offline'));
    await fixture.whenStable();
    const { query } = fixture.componentInstance;
    expect(query.data()).toBeUndefined();
    expect((query.error() as Error).message).toBe('offline');
  });
});

@Component({ template: '' })
class StoreHost {
  constructor() {
    loadOnTags(['Notifications'], () => UiActions.setOnline({ online: true }));
  }
}

describe('loadOnTags (NgRx-backed data)', () => {
  it('dispatches now and again on each matching invalidation', () => {
    TestBed.configureTestingModule({ providers: [provideMockStore()] });
    const store = TestBed.inject<MockStore<object>>(MockStore);
    const dispatch = spyOn(store, 'dispatch');

    const fixture = TestBed.createComponent(StoreHost);
    expect(dispatch).toHaveBeenCalledTimes(1);

    TestBed.inject(CacheTags).invalidate('Notifications');
    TestBed.inject(CacheTags).invalidate('Booking');
    expect(dispatch).toHaveBeenCalledTimes(2);

    fixture.destroy();
    TestBed.inject(CacheTags).invalidate('Notifications');
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
