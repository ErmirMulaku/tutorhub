import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';

/** Reflects the theme/accent UI state onto <html> as data attributes. */
export function useTheme(): void {
  const theme = useAppSelector((s) => s.ui.theme);
  const accent = useAppSelector((s) => s.ui.accent);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
  }, [theme, accent]);
}
