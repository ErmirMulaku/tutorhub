import type { CSSProperties } from 'react';
import { cx } from './cx.js';

export interface SkeletonProps {
  /** CSS inline-size (width), e.g. `'100%'` or `'8rem'`. */
  width?: string | number;
  /** CSS block-size (height). */
  height?: string | number;
  /** Fully rounded (for avatar/line placeholders). */
  rounded?: boolean;
  className?: string | undefined;
}

/** Loading placeholder; the shimmer animates on `transform` only (GPU). */
export function Skeleton({
  width = '100%',
  height = '1rem',
  rounded = false,
  className,
}: SkeletonProps): React.JSX.Element {
  const style: CSSProperties = {
    inlineSize: width,
    blockSize: height,
    borderRadius: rounded ? '999px' : undefined,
  };
  return (
    <span
      className={cx('th-skeleton', className)}
      style={style}
      aria-hidden="true"
      data-testid="skeleton"
    />
  );
}
