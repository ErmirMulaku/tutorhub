import type { ReactNode } from 'react';
import { cx } from './cx.js';

/**
 * Visual tone. The three level tones map 1:1 onto the domain `Level` enum, but
 * the prop is a local string union so the package stays standalone (no
 * `@ermulaku/types` dependency); callers translate `Level` → tone.
 */
export type TagTone = 'neutral' | 'beginner' | 'intermediate' | 'advanced';

export interface TagProps {
  tone?: TagTone;
  children?: ReactNode;
  className?: string | undefined;
}

/** A small pill for subjects and skill levels. */
export function Tag({ tone = 'neutral', children, className }: TagProps): React.JSX.Element {
  return (
    <span className={cx('th-tag', tone !== 'neutral' && `th-tag--${tone}`, className)}>
      {children}
    </span>
  );
}
