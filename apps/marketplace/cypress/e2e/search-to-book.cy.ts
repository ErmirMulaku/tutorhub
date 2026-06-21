/**
 * The flagship Phase 5 acceptance flow: search for a tutor by subject, open the
 * profile, pick an available slot, and book a lesson — all the way to the
 * confirmation. Runs against a freshly seeded API (tutors work weekdays 09–17).
 */

/** First future weekday within the profile's 7-day window, as `YYYY-MM-DD`. */
function firstFutureWeekday(): string {
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) return d.toISOString().slice(0, 10);
  }
  // The window always contains a weekday, but satisfy the type checker.
  return new Date().toISOString().slice(0, 10);
}

describe('search → book', () => {
  it('finds a tutor by subject and books a lesson end to end', () => {
    cy.visit('/en/tutors');

    // Search narrows the grid to the maths tutor (debounced into the URL).
    cy.get('.discover-filters__search').type('Mathematics');
    cy.location('search').should('contain', 'subject=Mathematics');
    cy.get('.tutor-card-link').should('have.length', 1);
    cy.contains('.tutor-card__name', 'Ben Carter').should('be.visible');

    // Open the profile.
    cy.get('.tutor-card-link').first().click();
    cy.location('pathname', { timeout: 30000 }).should('include', '/tutor/');
    cy.contains('.profile__name', 'Ben Carter').should('be.visible');

    // Jump to a weekday that has availability, then book the first slot.
    cy.location('pathname').then((pathname) => {
      cy.visit(`${pathname}?date=${firstFutureWeekday()}`);
    });
    cy.get('.slot--btn').should('have.length.greaterThan', 0).first().click();

    // The booking sheet opens; confirm it.
    cy.get('.th-modal').should('be.visible');
    cy.contains('.th-modal .th-btn', 'Confirm booking').click();

    // Confirmation.
    cy.contains('.booking__success', 'Lesson booked!').should('be.visible');
  });
});
