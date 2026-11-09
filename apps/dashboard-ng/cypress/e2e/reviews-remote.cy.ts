/**
 * /reviews is served by a separately built app (apps/dashboard-reviews) that
 * the dashboard loads at runtime through Native Federation. These tests run
 * against the real remote dev server — only the API is faked.
 */
const REMOTE = Cypress.env('reviewsRemoteUrl') as string;

describe('Reviews remote', () => {
  it('loads /reviews from the remote and renders it inside the layout', () => {
    cy.intercept('GET', `${REMOTE}/remoteEntry.json`).as('remoteEntry');
    cy.intercept('GET', `${REMOTE}/routes*.js`).as('remoteRoutes');
    cy.mockApi();
    cy.visitSignedIn('/reviews');

    cy.wait('@remoteEntry').its('response.statusCode').should('eq', 200);
    cy.wait('@remoteRoutes');
    cy.contains('.topbar__title', 'Reviews');
    cy.get('.shell__content .rev-summary').should('contain.text', '4.7');
    cy.get('.shell__content th-review-card')
      .should('have.length', 1)
      .and('contain.text', 'Mia Chen');
    cy.contains('.sidebar__link--active', 'Reviews');
  });

  it('shows a fallback inside the layout when the remote is down, and the rest still works', () => {
    // Only the remote's entry: the shell serves a remoteEntry.json of its own.
    cy.intercept('GET', `${REMOTE}/remoteEntry.json`, { statusCode: 404, body: '' });
    cy.mockApi();
    cy.visitSignedIn('/reviews');

    cy.get('.shell__content [role=alert]').should(
      'contain.text',
      'Reviews is temporarily unavailable.',
    );
    cy.contains('.shell__content button', 'Retry').should('be.visible');
    cy.contains('.topbar__title', 'Reviews');
    cy.location('pathname').should('eq', '/reviews');

    cy.contains('.sidebar__link', 'Dashboard').click();
    cy.get('th-kpi-stat').should('have.length', 4);
    cy.contains('.sidebar__link', 'Calendar').click();
    cy.get('.cal').should('exist');
  });
});
