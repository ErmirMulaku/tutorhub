'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Sun/moon theme switch. The choice is persisted in the `th_theme` cookie and
 * applied to `<html data-theme>` so the server renders the right theme on the
 * next request with no flash. The visible icon is driven purely by CSS off the
 * `data-theme` attribute, so there is no hydration mismatch.
 */
export function ThemeToggle({ dict }: { dict: Dictionary }): React.JSX.Element {
  const [isDark, setIsDark] = useState(false);

  // Sync the label to the real attribute once mounted (SSR can't know it).
  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  const toggle = (): void => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    document.cookie = `th_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setIsDark(next === 'dark');
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? dict.theme.toLight : dict.theme.toDark}
      title={isDark ? dict.theme.toLight : dict.theme.toDark}
    >
      <svg
        className="theme-toggle__moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg
        className="theme-toggle__sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}
