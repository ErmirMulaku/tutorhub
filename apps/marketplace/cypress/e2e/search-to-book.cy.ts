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

    // Search narrows the grid to the maths tutors (debounced into the URL).
    // The search box writes a free-text `query` (name, subject, …); `subject=`
    // is the separate exact-subject filter.
    cy.get('.tutor-card-link')
      .its('length')
      .then((all) => {
        cy.get('.discover-filters__search').type('Mathematics');
        cy.location('search').should('contain', 'query=Mathematics');
        cy.get('.tutor-card-link').should('have.length.lessThan', all);
      });
    // Sara Khan teaches Mathematics, weekdays 09–17 in London (see the seed).
    cy.contains('.tutor-card__name', 'Sara Khan').should('be.visible');

    // Open the profile.
    cy.contains('.tutor-card-link', 'Sara Khan').click();
    cy.location('pathname', { timeout: 30000 }).should('include', '/tutor/');
    cy.contains('.profile__name', 'Sara Khan').should('be.visible');

    // Booking needs a signed-in student: dev-login the seeded demo student and
    // store its token in the app's session cookie. Without Stripe keys (as in
    // CI) the wizard books directly, without the payment step.
    cy.request('POST', `${Cypress.env('apiUrl') ?? 'http://localhost:4000'}/auth/dev-login`, {
      email: 'sara@example.com',
    }).then((res) => cy.setCookie('th_token', (res.body as { accessToken: string }).accessToken));

    // Jump to a weekday that has availability, then go through the wizard:
    // subject → time → confirm.
    cy.location('pathname').then((pathname) => {
      cy.visit(`${pathname}?date=${firstFutureWeekday()}`);
    });
    cy.contains('.wizard__chip', 'Mathematics').click();
    cy.contains('.profile__booking .th-btn', 'Continue').click();
    cy.get('.slot--btn').should('have.length.greaterThan', 0).first().click();
    cy.get('.profile__booking input[type=checkbox]').check();
    cy.contains('.profile__booking .th-btn', 'Confirm booking').click();

    // Confirmation.
    cy.contains('.booking__success', 'Lesson booked!').should('be.visible');
  });
});
