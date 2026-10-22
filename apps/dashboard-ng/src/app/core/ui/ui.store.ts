import {
  createActionGroup,
  createFeature,
  createReducer,
  emptyProps,
  on,
  props,
} from '@ngrx/store';

export type Theme = 'light' | 'dark';
export type Accent = 'teal' | 'indigo' | 'plum';

/**
 * Port of `ui-slice.ts`. The React slice's `selectedTutorId` is dropped: only
 * the unrouted legacy screens used it (see the migration doc).
 */
export interface UiState {
  theme: Theme;
  accent: Accent;
  /** Whether the tutor is bookable (the topbar online/hidden pill). */
  online: boolean;
  /** Mobile: whether the sidebar drawer is open. */
  sidebarOpen: boolean;
  /** Whether the "New lesson" modal is open. */
  newLessonOpen: boolean;
}

export const THEME_KEY = 'th_theme';
export const ACCENT_KEY = 'th_accent';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* ignore */
  }
  return 'light';
}

function initialAccent(): Accent {
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (saved === 'teal' || saved === 'indigo' || saved === 'plum') return saved;
  } catch {
    /* ignore */
  }
  return 'teal';
}

export function initialUiState(): UiState {
  return {
    theme: initialTheme(),
    accent: initialAccent(),
    online: true,
    sidebarOpen: false,
    newLessonOpen: false,
  };
}

export const UiActions = createActionGroup({
  source: 'UI',
  events: {
    'Set Theme': props<{ theme: Theme }>(),
    'Toggle Theme': emptyProps(),
    'Set Accent': props<{ accent: Accent }>(),
    'Set Online': props<{ online: boolean }>(),
    'Toggle Sidebar': emptyProps(),
    'Set Sidebar Open': props<{ open: boolean }>(),
    'Set New Lesson Open': props<{ open: boolean }>(),
  },
});

export const uiFeature = createFeature({
  name: 'ui',
  reducer: createReducer(
    initialUiState(),
    on(UiActions.setTheme, (state, { theme }): UiState => ({ ...state, theme })),
    on(
      UiActions.toggleTheme,
      (state): UiState => ({ ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }),
    ),
    on(UiActions.setAccent, (state, { accent }): UiState => ({ ...state, accent })),
    on(UiActions.setOnline, (state, { online }): UiState => ({ ...state, online })),
    on(
      UiActions.toggleSidebar,
      (state): UiState => ({ ...state, sidebarOpen: !state.sidebarOpen }),
    ),
    on(UiActions.setSidebarOpen, (state, { open }): UiState => ({ ...state, sidebarOpen: open })),
    on(
      UiActions.setNewLessonOpen,
      (state, { open }): UiState => ({ ...state, newLessonOpen: open }),
    ),
  ),
});
