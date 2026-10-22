interface Booking {
  id: string;
  status: string;
  student: { fullName: string };
}

describe('lessons', () => {
  it('accepts a pending request: mutation, toast, refetch, badges', () => {
    // A tiny stateful backend: once accepted, the API reports Mia as confirmed.
    let accepted = false;
    cy.mockApi({
      acceptBooking: ({ id }: Record<string, unknown>) => {
        accepted = true;
        return { id, status: 'CONFIRMED' };
      },
      tutorBookings: (_vars: unknown, bookings: Booking[]) =>
        bookings.map((b) => (accepted && b.id === 'b-mia' ? { ...b, status: 'CONFIRMED' } : b)),
      dashboardSummary: (_vars: unknown, summary: { pendingCount: number }) => ({
        ...summary,
        pendingCount: accepted ? 1 : 2,
      }),
    });
    cy.visitSignedIn('/lessons?status=pending');

    cy.get('.lesson-row').should('have.length', 2);
    cy.contains('.segtabs__tab', 'Pending').find('.segtabs__badge').should('have.text', '2');

    cy.contains('.lesson-row', 'Mia Chen').contains('button', 'Accept').click();

    cy.wait('@acceptBooking').its('request.body.variables').should('deep.equal', { id: 'b-mia' });
    cy.contains('.toast', "Accepted Mia Chen's lesson");
    // The mutation invalidated Booking + DashboardSummary, so both refetched.
    cy.get('.lesson-row').should('have.length', 1).and('contain', 'Tom Becker');
    cy.contains('.segtabs__tab', 'Pending').find('.segtabs__badge').should('have.text', '1');
    cy.contains('.sidebar__link', 'Lessons').find('.sidebar__badge').should('have.text', '1');
  });

  it('searches across every status from the topbar, live, then clears', () => {
    cy.mockApi();
    cy.visitSignedIn('/lessons');
    cy.get('.lesson-row').should('have.length', 1); // Upcoming: Sofia's confirmed lesson

    cy.get('input[aria-label="Search"]').type('sofia');
    // Debounced into the URL without pressing Enter.
    cy.location('search').should('eq', '?q=sofia');
    cy.contains('.lessons__searchchip', 'Results for “sofia”');
    cy.get('.lesson-row')
      .should('have.length', 2)
      .each(($row) => {
        expect($row.text()).to.contain('Sofia Ricci');
      });

    cy.get('button[aria-label="Clear search"]').click();
    cy.location('search').should('eq', '');
    cy.get('.segtabs').should('be.visible');
  });
});
