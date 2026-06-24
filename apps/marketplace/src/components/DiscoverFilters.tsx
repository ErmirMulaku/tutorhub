'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Level } from '@ermulaku/types';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Search + level + price + rating + sort filters. Edits are written to the URL
 * query string (debounced for the text input), which re-runs the server
 * component's `getTutors` fetch — keeping the grid server-rendered while the
 * controls feel instant.
 */
export function DiscoverFilters({ dict }: { dict: Dictionary }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(params.get('query') ?? '');
  const level = params.get('level') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const minRating = params.get('minRating') ?? '';
  const sort = params.get('sort') ?? 'relevance';

  const commit = (next: URLSearchParams): void => {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };

  const setParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    commit(next);
  };

  // Debounce the free-text search before touching the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set('query', query);
      else next.delete('query');
      if (next.toString() !== params.toString()) commit(next);
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const levelLabel = (lvl: Level): string => {
    switch (lvl) {
      case Level.Beginner:
        return dict.discover.levelBEGINNER;
      case Level.Intermediate:
        return dict.discover.levelINTERMEDIATE;
      default:
        return dict.discover.levelADVANCED;
    }
  };

  const clear = (): void => startTransition(() => router.replace(pathname));
  const hasFilters = query || level || maxPrice || minRating || sort !== 'relevance';

  return (
    <div className="discover-filters">
      <input
        type="search"
        className="discover-filters__search"
        placeholder={dict.discover.searchPlaceholder}
        aria-label={dict.discover.searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <label className="discover-filters__field">
        <span className="discover-filters__label">{dict.discover.filterLevel}</span>
        <select value={level} onChange={(e) => setParam('level', e.target.value)}>
          <option value="">{dict.discover.filterAll}</option>
          {Object.values(Level).map((lvl) => (
            <option key={lvl} value={lvl}>
              {levelLabel(lvl)}
            </option>
          ))}
        </select>
      </label>

      <label className="discover-filters__field">
        <span className="discover-filters__label">{dict.discover.maxPrice}</span>
        <select value={maxPrice} onChange={(e) => setParam('maxPrice', e.target.value)}>
          <option value="">{dict.discover.filterAll}</option>
          <option value="30">≤ 30</option>
          <option value="40">≤ 40</option>
          <option value="50">≤ 50</option>
          <option value="60">≤ 60</option>
        </select>
      </label>

      <label className="discover-filters__field">
        <span className="discover-filters__label">{dict.discover.minRating}</span>
        <select value={minRating} onChange={(e) => setParam('minRating', e.target.value)}>
          <option value="">{dict.discover.anyRating}</option>
          <option value="4.5">4.5+</option>
          <option value="4.8">4.8+</option>
          <option value="4.9">4.9+</option>
        </select>
      </label>

      <label className="discover-filters__field">
        <span className="discover-filters__label">{dict.discover.sort}</span>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="relevance">{dict.discover.sortRelevance}</option>
          <option value="priceAsc">{dict.discover.sortPriceAsc}</option>
          <option value="priceDesc">{dict.discover.sortPriceDesc}</option>
          <option value="rating">{dict.discover.sortRating}</option>
        </select>
      </label>

      {hasFilters && (
        <button type="button" className="discover-filters__clear" onClick={clear}>
          {dict.discover.clear}
        </button>
      )}
    </div>
  );
}
