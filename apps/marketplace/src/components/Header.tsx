import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { LocaleSwitcher } from './LocaleSwitcher';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  locale: Locale;
  dict: Dictionary;
  /** The signed-in student's display name, or `null` when browsing logged out. */
  userName: string | null;
}

/** Sticky top navigation: brand, primary links, locale switcher and account menu. */
export function Header({ locale, dict, userName }: HeaderProps): React.JSX.Element {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href={`/${locale}`} className="site-header__brand">
          {dict.brand}
        </Link>
        <nav className="site-header__nav">
          <Link href={`/${locale}/tutors`}>{dict.nav.discover}</Link>
          {userName !== null && (
            <Link href={`/${locale}/lessons`} className="site-header__nav-link">
              {dict.nav.lessons}
            </Link>
          )}
          <LocaleSwitcher current={locale} />
          {userName !== null ? (
            <UserMenu locale={locale} name={userName} dict={dict} />
          ) : (
            <Link href={`/${locale}/login`} className="site-header__signin">
              {dict.nav.signIn}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
