'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx.js';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible dialog title; also rendered as the heading. */
  title?: ReactNode;
  children?: ReactNode;
  className?: string | undefined;
  /** Close when the backdrop is clicked (default true). */
  closeOnBackdrop?: boolean;
}

/** Matches `--th-duration`; the exit animation is allowed to finish first. */
const EXIT_MS = 200;

/**
 * Accessible dialog with a GPU-only enter/exit (overlay `opacity`, panel
 * `transform`+`opacity`). Stays mounted through the exit transition, portals to
 * `document.body`, locks scroll, closes on Escape/backdrop, and restores focus.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  closeOnBackdrop = true,
}: ModalProps): React.JSX.Element | null {
  // `mounted` keeps the node in the DOM during the exit animation; `visible`
  // drives the `data-state` that triggers the CSS transition.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const titleId = useRef(`th-modal-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      // Next frame: flip to the visible state so the transition runs.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Focus the panel on open; restore focus to the trigger on close.
  useEffect(() => {
    if (visible) {
      panelRef.current?.focus();
    } else if (!mounted) {
      lastFocused.current?.focus?.();
    }
  }, [visible, mounted]);

  // Lock body scroll while any modal is mounted.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onBackdrop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (closeOnBackdrop && e.target === e.currentTarget) onClose();
    },
    [closeOnBackdrop, onClose],
  );

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="th-modal-overlay" data-state={visible ? 'open' : 'closed'} onClick={onBackdrop}>
      <div
        ref={panelRef}
        className={cx('th-modal', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : undefined}
        tabIndex={-1}
      >
        <button type="button" className="th-modal__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        {title ? <h2 id={titleId.current}>{title}</h2> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
