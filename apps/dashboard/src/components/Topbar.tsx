import { type FormEvent, type JSX, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@ermulaku/ui';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  type Accent,
  setAccent,
  setNewLessonOpen,
  setOnline,
  toggleSidebar,
  toggleTheme,
} from '../store/ui-slice';
import { PAGE_META } from '../app/nav';
import { MenuIcon, MoonIcon, SearchIcon, SunIcon } from './icons';
import { NotificationsBell } from './NotificationsBell';

const ACCENTS: { key: Accent; label: string; swatch: string }[] = [
  { key: 'teal', label: 'Teal', swatch: '#0e8f8a' },
  { key: 'indigo', label: 'Indigo', swatch: '#4f56d6' },
  { key: 'plum', label: 'Plum', swatch: '#8b46c9' },
];

export function Topbar(): JSX.Element {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const accent = useAppSelector((s) => s.ui.accent);
  const online = useAppSelector((s) => s.ui.online);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const meta = PAGE_META[pathname] ?? { title: 'Dashboard', subtitle: '' };
  const [query, setQuery] = useState('');

  function onSearch(e: FormEvent): void {
    e.preventDefault();
    const q = query.trim();
    if (q !== '') void navigate(`/lessons?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu"
        aria-label="Open menu"
        onClick={() => dispatch(toggleSidebar())}
      >
        <MenuIcon />
      </button>
      <div className="topbar__heading">
        <h1 className="topbar__title">{meta.title}</h1>
        {meta.subtitle && <p className="topbar__subtitle">{meta.subtitle}</p>}
      </div>

      <div className="topbar__actions">
        <form className="topbar__search" onSubmit={onSearch}>
          <SearchIcon className="topbar__search-icon" />
          <input
            type="search"
            placeholder="Search students, lessons…"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <button
          type="button"
          className={`topbar__pill${online ? ' topbar__pill--on' : ''}`}
          onClick={() => dispatch(setOnline(!online))}
          aria-pressed={online}
        >
          <span className="topbar__dot" />
          {online ? 'Online' : 'Hidden'}
        </button>

        <div className="topbar__accents" role="group" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`topbar__accent${accent === a.key ? ' topbar__accent--active' : ''}`}
              style={{ background: a.swatch }}
              title={a.label}
              aria-label={a.label}
              aria-pressed={accent === a.key}
              onClick={() => dispatch(setAccent(a.key))}
            />
          ))}
        </div>

        <button
          type="button"
          className="topbar__icon-btn"
          onClick={() => dispatch(toggleTheme())}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <NotificationsBell />

        <Button size="sm" onClick={() => dispatch(setNewLessonOpen(true))}>
          New lesson
        </Button>
      </div>
    </header>
  );
}
