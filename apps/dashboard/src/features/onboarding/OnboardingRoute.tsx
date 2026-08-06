import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { OnboardingWizard } from './OnboardingWizard';
import { useProfilePublished } from './use-profile-published';

/**
 * Onboarding is a one-time flow: once a tutor publishes, `/onboarding` sends
 * them to the dashboard instead of back through the wizard.
 *
 * Renders nothing until the flag is known so a published tutor never sees a
 * flash of the wizard before the redirect.
 */
export function OnboardingRoute(): JSX.Element | null {
  const { published, loading } = useProfilePublished();

  if (loading) return null;
  if (published) return <Navigate to="/dashboard" replace />;
  return <OnboardingWizard />;
}
