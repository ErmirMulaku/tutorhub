import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { useAppSelector } from '../store/hooks';

/** Authenticated layout: sidebar + topbar + routed content. */
export function AppShell(): JSX.Element {
  const token = useAppSelector((s) => s.auth.token);
  if (token === null) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <Topbar />
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
