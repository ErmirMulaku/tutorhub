import {
  DestroyRef,
  Injectable,
  type ResourceRef,
  type Signal,
  computed,
  inject,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type Action, Store } from '@ngrx/store';
import { type Observable, Subject, filter, startWith } from 'rxjs';

/** The same cache tags as `tagTypes` in apps/dashboard/src/store/api.ts. */
export type CacheTag =
  | 'Booking'
  | 'MeTutor'
  | 'DashboardSummary'
  | 'Service'
  | 'Availability'
  | 'Conversation'
  | 'Message'
  | 'Earnings'
  | 'Marketing'
  | 'Reviews'
  | 'Analytics'
  | 'Settings'
  | 'Notifications';

/**
 * The Angular stand-in for RTK Query's tag invalidation. A mutation calls
 * `invalidate('Booking', …)` with the same tags its React endpoint listed in
 * `invalidatesTags`; anything on screen that loaded data under those tags
 * reloads it. `invalidate()` with no tags means "everything" (used when the
 * signed-in tutor changes).
 */
@Injectable({ providedIn: 'root' })
export class CacheTags {
  private readonly invalidated$ = new Subject<readonly CacheTag[] | 'all'>();

  invalidate(...tags: CacheTag[]): void {
    this.invalidated$.next(tags);
  }

  invalidateAll(): void {
    this.invalidated$.next('all');
  }

  /** Emits whenever any of `tags` is invalidated. */
  changes(tags: readonly CacheTag[]): Observable<unknown> {
    return this.invalidated$.pipe(
      filter((hit) => hit === 'all' || hit.some((tag) => tags.includes(tag))),
    );
  }
}

/**
 * A component-scoped query — the closest thing to an RTK Query hook for data
 * that doesn't live in NgRx. Built on Angular's `rxResource`: loads when
 * created, reloads when one of `tags` is invalidated (keeping the old value
 * on screen meanwhile, like RTK's `isFetching`), and is torn down with the
 * component. Call it in a field initializer (an injection context).
 *
 * `params` works like a hook argument: when it changes, the query re-runs;
 * when it returns `undefined`, nothing is fetched (RTK's `skip`).
 */
export function cachedQuery<T, P = true>(options: {
  tags: readonly CacheTag[];
  params?: () => P | undefined;
  load: (params: P) => Observable<T>;
}): CachedQuery<T> {
  const resource: ResourceRef<T | undefined> = rxResource({
    params: options.params ?? ((): P => true as P),
    stream: ({ params }) => options.load(params),
  });
  inject(CacheTags)
    .changes(options.tags)
    .pipe(takeUntilDestroyed(inject(DestroyRef)))
    .subscribe(() => resource.reload());

  return {
    // `value()` throws while the resource is in an error state; `data` doesn't.
    data: computed(() => (resource.hasValue() ? resource.value() : undefined)),
    isLoading: computed(() => resource.isLoading() && !resource.hasValue()),
    error: computed(() => resource.error()),
    reload: () => resource.reload(),
  };
}

export interface CachedQuery<T> {
  data: Signal<T | undefined>;
  /** True only for the first load (RTK's `isLoading`), not background reloads. */
  isLoading: Signal<boolean>;
  error: Signal<unknown>;
  reload: () => void;
}

/**
 * For data that lives in NgRx: dispatch `action()` now, and again whenever one
 * of `tags` is invalidated, for as long as the calling component is alive.
 * The NgRx effect does the HTTP call; this decides *when*.
 */
export function loadOnTags(tags: readonly CacheTag[], action: () => Action): void {
  const store = inject(Store);
  inject(CacheTags)
    .changes(tags)
    .pipe(startWith(null), takeUntilDestroyed(inject(DestroyRef)))
    .subscribe(() => store.dispatch(action()));
}
