interface Promotion {
  id: string;
  name: string;
  code: string;
  discountType: string;
  discountValue: number;
  state: string;
  expiresAt: string | null;
  redemptions: number;
}

describe('marketing', () => {
  it('blocks an invalid promotion, then creates a fixed one in cents', () => {
    const created: Promotion[] = [];
    cy.mockApi({
      createPromotion: ({
        input,
      }: {
        input: Omit<Promotion, 'id' | 'state' | 'expiresAt' | 'redemptions'>;
      }) => {
        created.push({ ...input, id: 'p-new', state: 'ACTIVE', expiresAt: null, redemptions: 0 });
        return { id: 'p-new' };
      },
      promotions: (_vars: unknown, promotions: Promotion[]) => [...created, ...promotions],
    });
    cy.visitSignedIn('/marketing');
    cy.get('th-promo-card').should('have.length', 1);

    cy.contains('button', 'New promotion').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('input[formControlName="name"]').type('A');
      cy.get('input[formControlName="code"]').type('ng');
      cy.get('input[formControlName="amount"]').clear().type('150');
      cy.contains('button', 'Create promotion').click();
      cy.contains('Use at least 2 characters.');
      cy.contains('Use at least 3 characters.');
      cy.contains('Must be at most 100.');
    });
    // Nothing was sent (the alias only exists once a request has matched).
    cy.then(() => expect(created, 'promotions sent to the API').to.have.length(0));

    cy.get('[role="dialog"]').within(() => {
      cy.get('input[formControlName="name"]').clear().type('Summer deal');
      cy.get('input[formControlName="code"]').clear().type('summer26');
      cy.get('input[formControlName="code"]').should('have.value', 'SUMMER26');
      cy.get('select').select('FIXED');
      cy.contains('Amount off (USD)');
      cy.get('input[formControlName="amount"]').clear().type('12.5');
      cy.contains('button', 'Create promotion').click();
    });

    cy.wait('@createPromotion').its('request.body.variables.input').should('deep.equal', {
      name: 'Summer deal',
      code: 'SUMMER26',
      discountType: 'FIXED',
      discountValue: 1250,
    });
    cy.contains('.toast', 'Promotion created');
    cy.get('[role="dialog"]').should('not.exist');
    // `Marketing` was invalidated, so the grid refetched with the new card first.
    cy.get('th-promo-card').should('have.length', 2).first().should('contain', 'Summer deal');
  });
});
