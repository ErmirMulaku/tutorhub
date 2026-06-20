/** API origin for server-side GraphQL fetches. Configurable per environment. */
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const GRAPHQL_URL = `${API_URL}/graphql`;
