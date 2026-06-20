import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the hover-lift affordance (GPU `transform`). */
  interactive?: boolean;
  children?: ReactNode;
}

/** A surface container. Set `interactive` for clickable cards (tutor tiles). */
export function Card({
  interactive = false,
  className,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <div
      className={cx('th-card', interactive && 'th-card--interactive', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
