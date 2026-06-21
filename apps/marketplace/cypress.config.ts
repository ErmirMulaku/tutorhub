import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
    fixturesFolder: false,
    video: false,
    screenshotOnRunFailure: false,
    // Dev-mode route compilation can be slow on first hit.
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
  },
});
