import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  type UiState,
  selectTutor,
  setAccent,
  setOnline,
  setTheme,
  toggleSidebar,
  toggleTheme,
  uiReducer,
} from './ui-slice';

const base: UiState = {
  selectedTutorId: null,
  theme: 'light',
  accent: 'teal',
  online: true,
  sidebarOpen: false,
};

describe('ui slice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with sensible defaults', () => {
    const state = uiReducer(undefined, { type: '@@init' });
    expect(state.selectedTutorId).toBeNull();
    expect(state.theme).toBe('light');
    expect(state.accent).toBe('teal');
    expect(state.online).toBe(true);
  });

  it('selects and clears a tutor', () => {
    const selected = uiReducer(base, selectTutor('tutor-1'));
    expect(selected.selectedTutorId).toBe('tutor-1');
    expect(uiReducer(selected, selectTutor(null)).selectedTutorId).toBeNull();
  });

  it('sets and toggles the theme', () => {
    expect(uiReducer(base, setTheme('dark')).theme).toBe('dark');
    expect(uiReducer(base, toggleTheme()).theme).toBe('dark');
    expect(uiReducer({ ...base, theme: 'dark' }, toggleTheme()).theme).toBe('light');
  });

  it('sets the accent and online status', () => {
    expect(uiReducer(base, setAccent('plum')).accent).toBe('plum');
    expect(uiReducer(base, setOnline(false)).online).toBe(false);
  });

  it('toggles the mobile sidebar', () => {
    expect(uiReducer(base, toggleSidebar()).sidebarOpen).toBe(true);
    expect(uiReducer({ ...base, sidebarOpen: true }, toggleSidebar()).sidebarOpen).toBe(false);
  });
});
