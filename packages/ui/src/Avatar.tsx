import { cx } from './cx.js';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Full name — drives the fallback initials and the accessible label. */
  name: string;
  /** Optional image; falls back to initials when absent or it fails to load. */
  src?: string | undefined;
  size?: AvatarSize;
  className?: string | undefined;
}

/** Derive up to two uppercase initials from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Circular tutor/student avatar with an initials fallback. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps): React.JSX.Element {
  return (
    <span
      className={cx('th-avatar', `th-avatar--${size}`, className)}
      role="img"
      aria-label={name}
    >
      {src ? <img src={src} alt="" aria-hidden="true" /> : initials(name)}
    </span>
  );
}
