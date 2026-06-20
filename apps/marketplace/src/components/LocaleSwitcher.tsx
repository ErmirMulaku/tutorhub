'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localeName, locales, type Locale } from '@/i18n/config';

/**
 * Swaps the leading `/{locale}` segment of the current path, preserving the
 * rest of the route so the user stays on the same page across languages.
 */
export function LocaleSwitcher({ current }: { current: Locale }): React.JSX.Element {
  const pathname = usePathname();

  const pathFor = (locale: Locale): string => {
    const segments = pathname.split('/');
    // segments[0] is '' (leading slash); segments[1] is the current locale.
    segments[1] = locale;
    return segments.join('/') || `/${locale}`;
  };

  return (
    <div className="locale-switcher" aria-label="Language">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={pathFor(locale)}
          aria-current={locale === current ? 'true' : undefined}
          hrefLang={locale}
        >
          {localeName[locale]}
        </Link>
      ))}
    </div>
  );
}
