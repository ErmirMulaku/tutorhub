import { type PayloadAction, createSlice } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark';
export type Accent = 'teal' | 'indigo' | 'plum';

export interface UiState {
  /** The tutor whose calendar / bookings the dashboard is showing. */
  selectedTutorId: string | null;
  theme: Theme;
  accent: Accent;
  /** Whether the tutor is bookable (the topbar online/hidden pill). */
  online: boolean;
  /** Mobile: whether the sidebar drawer is open. */
  sidebarOpen: boolean;
}

const THEME_KEY = 'th_theme';
const ACCENT_KEY = 'th_accent';

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

const initialState: UiState = {
  selectedTutorId: null,
  theme: initialTheme(),
  accent: initialAccent(),
  online: true,
  sidebarOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectTutor(state, action: PayloadAction<string | null>) {
      state.selectedTutorId = action.payload;
    },
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      try {
        localStorage.setItem(THEME_KEY, action.payload);
      } catch {
        /* ignore */
      }
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, state.theme);
      } catch {
        /* ignore */
      }
    },
    setAccent(state, action: PayloadAction<Accent>) {
      state.accent = action.payload;
      try {
        localStorage.setItem(ACCENT_KEY, action.payload);
      } catch {
        /* ignore */
      }
    },
    setOnline(state, action: PayloadAction<boolean>) {
      state.online = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
  },
});

export const {
  selectTutor,
  setTheme,
  toggleTheme,
  setAccent,
  setOnline,
  toggleSidebar,
  setSidebarOpen,
} = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
