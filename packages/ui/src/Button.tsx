import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full inline width of the container. */
  block?: boolean;
  children?: ReactNode;
}

/** The primary action control. Hover/press animate on `transform` only (GPU). */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={cx(
        'th-btn',
        `th-btn--${variant}`,
        `th-btn--${size}`,
        block && 'th-btn--block',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
