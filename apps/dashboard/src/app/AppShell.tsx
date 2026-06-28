import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { ToastProvider } from '../components/ToastProvider';
import { useLiveBookings } from '../features/live/use-live-bookings';
import { useAppSelector } from '../store/hooks';

/** Authenticated layout: sidebar + topbar + routed content. */
export function AppShell(): JSX.Element {
  const token = useAppSelector((s) => s.auth.token);
  const tutorId = useAppSelector((s) => s.auth.tutorId);
  useLiveBookings(token === null ? null : tutorId);

  if (token === null) return <Navigate to="/login" replace />;

  return (
    <ToastProvider>
      <div className="shell">
        <Sidebar />
        <div className="shell__main">
          <Topbar />
          <main className="shell__content">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
