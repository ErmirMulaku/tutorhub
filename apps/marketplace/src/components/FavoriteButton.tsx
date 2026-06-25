'use client';

import { useState, useTransition } from 'react';
import { cx } from '@ermulaku/ui';
import { toggleFavoriteAction } from '@/lib/actions';

interface FavoriteButtonProps {
  tutorId: string;
  initial: boolean;
  label: string;
  /** `icon` = heart only (cards); `full` = heart + label (profile). */
  variant?: 'icon' | 'full';
}

/** Optimistic heart toggle that persists via the `toggleFavoriteAction`. */
export function FavoriteButton({
  tutorId,
  initial,
  label,
  variant = 'icon',
}: FavoriteButtonProps): React.JSX.Element {
  const [saved, setSaved] = useState(initial);
  const [, startTransition] = useTransition();

  const toggle = (e: React.MouseEvent): void => {
    // Cards wrap the button in a profile <Link>; don't navigate on toggle.
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const res = await toggleFavoriteAction(tutorId, next);
      if (!res.ok) setSaved(!next);
    });
  };

  return (
    <button
      type="button"
      className={cx('fav-btn', variant === 'full' && 'fav-btn--full', saved && 'is-saved')}
      aria-pressed={saved}
      aria-label={label}
      onClick={toggle}
    >
      <span aria-hidden="true" className="fav-btn__heart">
        {saved ? '♥' : '♡'}
      </span>
      {variant === 'full' && <span>{label}</span>}
    </button>
  );
}
