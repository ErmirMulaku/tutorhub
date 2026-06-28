import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from '../features/auth/LoginScreen';
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
        <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
        <Route path="/calendar" element={<Placeholder title="Calendar" />} />
        <Route path="/lessons" element={<Placeholder title="Lessons" />} />
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
