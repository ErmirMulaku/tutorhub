import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AnalyticsScreen } from '../features/analytics/AnalyticsScreen';
import { AvailabilityScreen } from '../features/availability/AvailabilityScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { CatalogScreen } from '../features/catalog/CatalogScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { EarningsScreen } from '../features/earnings/EarningsScreen';
import { LessonsScreen } from '../features/lessons/LessonsScreen';
import { MarketingScreen } from '../features/marketing/MarketingScreen';
import { MessagesScreen } from '../features/messages/MessagesScreen';
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard';
import { ReviewsScreen } from '../features/reviews/ReviewsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AppShell } from './AppShell';
import { useTheme } from './use-theme';

export function App(): JSX.Element {
  useTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/lessons" element={<LessonsScreen />} />
        <Route path="/messages" element={<MessagesScreen />} />
        <Route path="/catalog" element={<CatalogScreen />} />
        <Route path="/availability" element={<AvailabilityScreen />} />
        <Route path="/earnings" element={<EarningsScreen />} />
        <Route path="/marketing" element={<MarketingScreen />} />
        <Route path="/reviews" element={<ReviewsScreen />} />
        <Route path="/analytics" element={<AnalyticsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
