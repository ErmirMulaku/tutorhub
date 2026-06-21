'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Level } from '@ermulaku/types';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Search + level filters. Edits are written to the URL query string (debounced
 * for the text input), which re-runs the server component's `getTutors` fetch —
 * keeping the grid server-rendered while the controls feel instant.
 */
export function DiscoverFilters({ dict }: { dict: Dictionary }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [subject, setSubject] = useState(params.get('subject') ?? '');
  const level = params.get('level') ?? '';

  const commit = (next: URLSearchParams): void => {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };

  // Debounce the free-text search before touching the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (subject) next.set('subject', subject);
      else next.delete('subject');
      if (next.toString() !== params.toString()) commit(next);
    }, 300);
    return () => clearTimeout(id);
  }, [subject]);

  const onLevel = (value: string): void => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set('level', value);
    else next.delete('level');
    commit(next);
  };

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

  return (
    <div className="discover-filters">
      <input
        type="search"
        className="discover-filters__search"
        placeholder={dict.discover.searchPlaceholder}
        aria-label={dict.discover.searchPlaceholder}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <label className="discover-filters__level">
        <span className="discover-filters__level-label">{dict.discover.filterLevel}</span>
        <select value={level} onChange={(e) => onLevel(e.target.value)}>
          <option value="">{dict.discover.filterAll}</option>
          {Object.values(Level).map((lvl) => (
            <option key={lvl} value={lvl}>
              {levelLabel(lvl)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
