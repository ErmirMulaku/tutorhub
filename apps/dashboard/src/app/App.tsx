import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from '../features/auth/LoginScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { LessonsScreen } from '../features/lessons/LessonsScreen';
import { AppShell } from './AppShell';
import { Placeholder } from './Placeholder';
import { useTheme } from './use-theme';

export function App(): JSX.Element {
  useTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/onboarding" element={<Placeholder title="Onboarding" />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/lessons" element={<LessonsScreen />} />
        <Route path="/messages" element={<Placeholder title="Messages" />} />
        <Route path="/catalog" element={<Placeholder title="Catalog" />} />
        <Route path="/availability" element={<Placeholder title="Availability" />} />
        <Route path="/earnings" element={<Placeholder title="Earnings" />} />
        <Route path="/marketing" element={<Placeholder title="Marketing" />} />
        <Route path="/reviews" element={<Placeholder title="Reviews" />} />
        <Route path="/analytics" element={<Placeholder title="Analytics" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
