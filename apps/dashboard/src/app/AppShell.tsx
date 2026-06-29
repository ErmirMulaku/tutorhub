import { type JSX, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { ToastProvider } from '../components/ToastProvider';
import { NewLessonModal } from '../features/lessons/NewLessonModal';
import { useLiveBookings } from '../features/live/use-live-bookings';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSidebarOpen } from '../store/ui-slice';

/** Authenticated layout: sidebar + topbar + routed content. */
export function AppShell(): JSX.Element {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const tutorId = useAppSelector((s) => s.auth.tutorId);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const { pathname } = useLocation();
  useLiveBookings(token === null ? null : tutorId);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    dispatch(setSidebarOpen(false));
  }, [pathname, dispatch]);

  if (token === null) return <Navigate to="/login" replace />;

  return (
    <ToastProvider>
      <div className={`shell${sidebarOpen ? ' shell--drawer-open' : ''}`}>
        <Sidebar />
        <button
          type="button"
          className="shell__backdrop"
          aria-label="Close menu"
          onClick={() => dispatch(setSidebarOpen(false))}
        />
        <div className="shell__main">
          <Topbar />
          <main className="shell__content">
            <Outlet />
          </main>
        </div>
        <NewLessonModal />
      </div>
    </ToastProvider>
  );
}
