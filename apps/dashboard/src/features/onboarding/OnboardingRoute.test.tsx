import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useProfilePublished = jest.fn<() => { published: boolean; loading: boolean }>();

// The wizard pulls in the whole RTK Query store, so it is stubbed — these tests
// are about which of the two destinations the route picks.
jest.unstable_mockModule('./use-profile-published', () => ({ useProfilePublished }));
jest.unstable_mockModule('./OnboardingWizard', () => ({
  OnboardingWizard: () => <div>onboarding wizard</div>,
}));

const { OnboardingRoute } = await import('./OnboardingRoute');

function renderAt(): void {
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OnboardingRoute', () => {
  beforeEach(() => {
    useProfilePublished.mockReset();
  });

  it('sends a published tutor to the dashboard instead of the wizard', () => {
    useProfilePublished.mockReturnValue({ published: true, loading: false });
    renderAt();

    expect(screen.queryByText('dashboard')).not.toBeNull();
    expect(screen.queryByText('onboarding wizard')).toBeNull();
  });

  it('shows the wizard to a tutor who has not published yet', () => {
    useProfilePublished.mockReturnValue({ published: false, loading: false });
    renderAt();

    expect(screen.queryByText('onboarding wizard')).not.toBeNull();
  });

  it('renders neither destination while the flag is still loading', () => {
    useProfilePublished.mockReturnValue({ published: false, loading: true });
    renderAt();

    // No flash of the wizard before a published tutor gets redirected.
    expect(screen.queryByText('onboarding wizard')).toBeNull();
    expect(screen.queryByText('dashboard')).toBeNull();
  });
});
