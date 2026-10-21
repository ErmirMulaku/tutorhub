import { graphqlError } from '../support/graphql';

describe('sign-in and session', () => {
  it('sends a signed-out visitor to /login', () => {
    cy.mockApi();
    cy.visit('/dashboard');
    cy.location('pathname').should('eq', '/login');
  });

  it('signs in without a token, then calls the API with one', () => {
    cy.mockApi();
    cy.visit('/login');
    cy.get('input[type=email]').clear().type('lena@tutor.example.com');
    cy.get('input[type=password]').clear().type('password123');
    cy.contains('button', 'Sign in').click();

    // The sign-in call itself carries no Authorization header (SKIP_AUTH).
    cy.wait('@tutorSignin').then(({ request }) => {
      expect(request.body.variables).to.deep.equal({
        e: 'lena@tutor.example.com',
        p: 'password123',
      });
      expect(request.headers).not.to.have.property('authorization');
    });

    cy.location('pathname').should('eq', '/dashboard');
    // Every call after it does (the interceptor reads the new token from NgRx).
    cy.wait('@meTutor').its('request.headers.authorization').should('eq', 'Bearer e2e-token');
    cy.contains('.sidebar__profile-name', 'Lena Hartmann');
    cy.contains('.dash__greeting h2', 'Lena');
    cy.contains('th-kpi-stat', 'Pending requests').should('contain', '2');
    cy.window().its('localStorage.th_tutor_token').should('eq', 'e2e-token');
  });

  it("shows the API's message for wrong credentials and stays on /login", () => {
    cy.mockApi({ tutorSignin: graphqlError('Invalid email or password') });
    cy.visit('/login');
    cy.get('input[type=password]').clear().type('wrong-password');
    cy.contains('button', 'Sign in').click();

    cy.contains('.login__error', 'Invalid email or password');
    cy.location('pathname').should('eq', '/login');
  });

  it('signs out when the API rejects the session — a GraphQL error sent as HTTP 200', () => {
    cy.mockApi({ meTutor: graphqlError('Unauthorized') });
    cy.visitSignedIn('/dashboard');

    cy.location('pathname').should('eq', '/login');
    cy.window().its('localStorage.th_tutor_token').should('be.undefined');
  });

  it('signs out from the sidebar; the theme choice survives', () => {
    cy.mockApi();
    cy.visitSignedIn('/dashboard');
    cy.get('button[aria-label^="Switch to"]').then(($toggle) => {
      const next = $toggle.attr('aria-label') === 'Switch to dark theme' ? 'dark' : 'light';
      cy.wrap($toggle).click();
      cy.get('html').should('have.attr', 'data-theme', next);

      cy.contains('button', 'Sign out').click();
      cy.location('pathname').should('eq', '/login');
      cy.get('html').should('have.attr', 'data-theme', next);
      cy.reload();
      cy.get('html').should('have.attr', 'data-theme', next);
    });
  });
});
