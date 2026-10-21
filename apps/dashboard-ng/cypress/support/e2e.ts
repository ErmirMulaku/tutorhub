/**
 * A fake TutorHub API for the dashboard E2E tests — no server, no database.
 *
 * Every request is a POST to /graphql, so one `cy.intercept` answers them all:
 * it reads the operation's root field (`meTutor`, `tutorBookings`,
 * `acceptBooking`, …), aliases the request by that name (`cy.wait('@meTutor')`)
 * and replies with that field's entry from fixtures/graphql.json — or from a
 * per-test override, which may be a function for stateful flows.
 *
 * An operation without a fixture is answered with a GraphQL error and fails
 * the test in `afterEach`, so a screen can't quietly render against nothing.
 */
import { type Resolver, isGraphqlBody, rootField } from './graphql';

const API = Cypress.env('apiUrl') as string;

let unmocked: string[] = [];

declare global {
  namespace Cypress {
    interface Chainable {
      /** Answer every API call from the fixtures (plus `overrides`). */
      mockApi(overrides?: Record<string, Resolver>): Chainable<void>;
      /** Visit a page with a stored session, as if the tutor had signed in before. */
      visitSignedIn(path: string): Chainable<Cypress.AUTWindow>;
    }
  }
}

type ResolverFn = (variables: Record<string, unknown>, fallback: unknown) => unknown;

Cypress.Commands.add('mockApi', (overrides: Record<string, Resolver> = {}) => {
  cy.fixture<Record<string, unknown>>('graphql.json').then((defaults) => {
    cy.intercept('POST', `${API}/graphql`, (req) => {
      const { query, variables = {} } = req.body as {
        query: string;
        variables?: Record<string, unknown>;
      };
      const field = rootField(query);
      req.alias = field;

      const has = (o: object): boolean => Object.prototype.hasOwnProperty.call(o, field);
      if (!has(overrides) && !has(defaults)) {
        unmocked.push(field);
        req.reply({ errors: [{ message: `No fixture for ${field}` }] });
        return;
      }
      const resolver = has(overrides) ? overrides[field] : defaults[field];
      const value =
        typeof resolver === 'function'
          ? (resolver as ResolverFn)(variables, defaults[field])
          : resolver;
      req.reply(isGraphqlBody(value) ? value.body : { data: { [field]: value } });
    });
  });
  // No live server in E2E: refuse the Socket.IO handshake (the app retries quietly).
  cy.intercept(`${API}/socket.io/*`, { statusCode: 503, body: '' });
});

Cypress.Commands.add('visitSignedIn', (path: string) =>
  cy.visit(path, {
    onBeforeLoad(win) {
      // The same keys the auth store restores a session from.
      win.localStorage.setItem('th_tutor_token', 'e2e-token');
      win.localStorage.setItem('th_tutor_id', 't-lena');
    },
  }),
);

beforeEach(() => {
  unmocked = [];
});

afterEach(() => {
  expect(unmocked, 'GraphQL operations without a fixture').to.deep.equal([]);
});
