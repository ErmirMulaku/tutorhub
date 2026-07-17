/** API origin for server-side GraphQL fetches. Configurable per environment. */
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const GRAPHQL_URL = `${API_URL}/graphql`;

/**
 * Origin of the tutor-facing dashboard app (a separate SPA). The "Become a tutor"
 * CTA points at its `/signup`. Defaults to the local dev server on port 3100.
 */
export const TUTOR_APP_URL = process.env.TUTOR_APP_URL ?? 'http://localhost:3100';
