'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@ermulaku/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { logoutAction } from '@/lib/actions';

interface UserMenuProps {
  locale: Locale;
  name: string;
  dict: Dictionary;
}

/** Avatar button that opens an account dropdown (account / wallet / log out). */
export function UserMenu({ locale, name, dict }: UserMenuProps): React.JSX.Element {
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

  const items: Array<{ href: string; label: string }> = [
    { href: `/${locale}/lessons`, label: dict.nav.lessons },
    { href: `/${locale}/favourites`, label: dict.nav.favourites },
    { href: `/${locale}/wallet`, label: dict.nav.wallet },
    { href: `/${locale}/account`, label: dict.nav.account },
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
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <p className="user-menu__name">{name}</p>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="user-menu__item"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={logout}
            disabled={isPending}
          >
            {dict.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
