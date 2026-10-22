/**
 * A smoke test over the whole signed-in app: every sidebar link loads its lazy
 * route and renders against the fixture API. The support file's afterEach
 * fails the test if any screen asks for an operation that has no fixture.
 */
const SCREENS: [link: string, title: string, content: string][] = [
  ['Calendar', 'Calendar', '.cal'],
  ['Lessons', 'Lessons', '.lesson-row'],
  ['Messages', 'Messages', '.chat'],
  ['Catalog', 'Catalog', '.svc'],
  ['Availability', 'Availability', 'th-weekly-hours-editor'],
  ['Earnings', 'Earnings', '.earn__balance'],
  ['Marketing', 'Marketing', 'th-promo-card'],
  ['Reviews', 'Reviews', '.rev-summary'],
  ['Analytics', 'Analytics', 'svg.areachart'],
  ['Settings', 'Settings', '.settings'],
  ['Dashboard', 'Dashboard', 'th-kpi-stat'],
];

describe('navigation', () => {
  it('opens every screen from the sidebar, each in its own lazy chunk', () => {
    cy.mockApi();
    cy.visitSignedIn('/dashboard');
    cy.get('th-kpi-stat').should('have.length', 4);

    for (const [link, title, content] of SCREENS) {
      cy.contains('.sidebar__link', link).click();
      cy.contains('.topbar__title', title);
      cy.get(content).should('exist');
      cy.get('th-error-state').should('not.exist');
    }
  });

  it('sends unknown URLs to the dashboard', () => {
    cy.mockApi();
    cy.visitSignedIn('/no-such-page');
    cy.location('pathname').should('eq', '/dashboard');
  });
});
