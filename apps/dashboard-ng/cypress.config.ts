import { defineConfig } from 'cypress';

/**
 * E2E tests for the Angular dashboard. The API is faked with `cy.intercept`
 * fixtures (cypress/support/e2e.ts), so only the dev servers have to run: the
 * dashboard and its Reviews remote (`npm run dev:mfe` at the repo root, ports
 * 3100 and 3101), then `npm run e2e`.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3100',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    // Desktop layout: below 1024px the sidebar becomes a drawer.
    viewportWidth: 1280,
    viewportHeight: 800,
    // Kept on failure only (gitignored; CI uploads them as an artifact).
    screenshotOnRunFailure: true,
    env: {
      // What the app was built with (angular.json `define` → API_URL).
      apiUrl: 'http://localhost:4000',
      // The Reviews remote, as listed in public/federation.manifest.json.
      reviewsRemoteUrl: 'http://localhost:3101',
    },
  },
});
