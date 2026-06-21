import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { LocaleSwitcher } from './LocaleSwitcher';

interface HeaderProps {
  locale: Locale;
  dict: Dictionary;
}

/** Sticky top navigation: brand, discover link, and the locale switcher. */
export function Header({ locale, dict }: HeaderProps): React.JSX.Element {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href={`/${locale}`} className="site-header__brand">
          {dict.brand}
        </Link>
        <nav className="site-header__nav">
          <Link href={`/${locale}/tutors`}>{dict.nav.discover}</Link>
          <LocaleSwitcher current={locale} />
        </nav>
      </div>
    </header>
  );
}
