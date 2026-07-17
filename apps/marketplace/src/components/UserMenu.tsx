'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { logoutAction } from '@/lib/actions';
import { TUTOR_APP_URL } from '@/lib/env';

interface UserMenuProps {
  locale: Locale;
  name: string;
  email: string;
  dict: Dictionary;
}

type IconName = 'lessons' | 'favourites' | 'wallet' | 'account' | 'tutor';

function MenuIcon({ name }: { name: IconName }): React.JSX.Element {
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'lessons':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'favourites':
      return (
        <svg {...common}>
          <path d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0 0 18.5 5 4 4 0 0 0 12 6 4 4 0 0 0 5.5 5 3.5 3.5 0 0 0 2 8.5C2 10.7 3.5 12.5 5 14l7 7z" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M16 12h.01M3 9h18" />
        </svg>
      );
    case 'account':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'tutor':
      return (
        <svg {...common}>
          <path d="M12 4 2 9l10 5 8-4v6" />
          <path d="M6 11.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5" />
        </svg>
      );
  }
}

/** Avatar button that opens an account dropdown (account / lessons / wallet / log out). */
export function UserMenu({ locale, name, email, dict }: UserMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const logout = (): void => {
    startTransition(async () => {
      await logoutAction();
      setOpen(false);
      router.push(`/${locale}`);
      router.refresh();
    });
  };

  const items: Array<{ href: string; label: string; icon: IconName }> = [
    { href: `/${locale}/account`, label: dict.nav.account, icon: 'account' },
    { href: `/${locale}/lessons`, label: dict.nav.lessons, icon: 'lessons' },
    { href: `/${locale}/favourites`, label: dict.nav.favourites, icon: 'favourites' },
    { href: `/${locale}/wallet`, label: dict.nav.wallet, icon: 'wallet' },
  ];

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={name} size="sm" />
        <svg
          className="user-menu__chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="user-menu__panel th-fade-up" role="menu">
          <div className="user-menu__header">
            <Avatar name={name} size="md" />
            <div className="user-menu__id">
              <p className="user-menu__name">{name}</p>
              <p className="user-menu__email">{email}</p>
            </div>
          </div>
          <div className="user-menu__items">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="user-menu__item"
                onClick={() => setOpen(false)}
              >
                <span className="user-menu__item-icon" aria-hidden="true">
                  <MenuIcon name={item.icon} />
                </span>
                {item.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={logout}
            disabled={isPending}
          >
            <span className="user-menu__item-icon" aria-hidden="true">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </span>
            {dict.nav.signOut}
          </button>
          {/* External link to the tutor-facing app — also in the header, kept here
              so it's reachable on mobile where the header pill is hidden. */}
          <a
            href={`${TUTOR_APP_URL}/signup`}
            role="menuitem"
            className="user-menu__item user-menu__item--cta"
            onClick={() => setOpen(false)}
          >
            <span className="user-menu__item-icon" aria-hidden="true">
              <MenuIcon name="tutor" />
            </span>
            {dict.nav.becomeTutor}
            <svg
              className="user-menu__item-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
