/** Runtime configuration. Mirrors apps/dashboard/src/env.ts. */
export const environment = {
  /** API base URL — inlined at build time, so changing it needs a rebuild. */
  apiUrl: API_URL,
} as const;
