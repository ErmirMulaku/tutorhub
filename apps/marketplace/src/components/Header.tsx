import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Notification } from '@/lib/queries';
import { AssistantNavTrigger } from './AssistantNavTrigger';
import { LocaleSwitcher } from './LocaleSwitcher';
import { NotificationsMenu } from './NotificationsMenu';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  locale: Locale;
  dict: Dictionary;
  /** The signed-in student's display name, or `null` when browsing logged out. */
  userName: string | null;
  /** The signed-in student's email (shown in the account dropdown). */
  userEmail: string | null;
  /** The student's notification feed (empty when logged out). */
  notifications: Notification[];
  unread: number;
}

/** Sticky top navigation: brand, primary links, locale/theme toggles, account menu. */
export function Header({
  locale,
  dict,
  userName,
  userEmail,
  notifications,
  unread,
}: HeaderProps): React.JSX.Element {
  const loggedIn = userName !== null;
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href={`/${locale}`} className="site-header__brand">
          <svg
            className="site-header__mark"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" opacity="0.35" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span>
            Tutor<span className="site-header__brand-accent">Hub</span>
          </span>
        </Link>
        <nav className="site-header__nav">
          <Link href={`/${locale}/tutors`} className="site-header__nav-link">
            {dict.nav.discover}
          </Link>
          {loggedIn && (
            <Link href={`/${locale}/lessons`} className="site-header__nav-link">
              {dict.nav.lessons}
            </Link>
          )}
          {/* Opens the global assistant widget. Public: anyone can open it; it
              prompts for sign-in before a turn, as it books on the caller's account. */}
          <AssistantNavTrigger label={dict.nav.assistant} />
          <div className="site-header__controls">
            <LocaleSwitcher current={locale} />
            <ThemeToggle dict={dict} />
            {loggedIn ? (
              <>
                <NotificationsMenu
                  locale={locale}
                  dict={dict}
                  items={notifications}
                  unread={unread}
                />
                <UserMenu locale={locale} name={userName} email={userEmail ?? ''} dict={dict} />
              </>
            ) : (
              <Link href={`/${locale}/login`} className="site-header__signin">
                {dict.nav.signIn}
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
