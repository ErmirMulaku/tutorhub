/**
 * @ermulaku/dashboard-kit — the code the tutor dashboard (the shell) and its
 * micro frontends share at runtime: auth state, the API layer and the UI
 * primitives the remotes render.
 *
 * Import only from this barrel (`@ermulaku/dashboard-kit`), never from a deep
 * path: Native Federation shares the barrel as one singleton bundle, so a deep
 * import would load a second copy (a second ToastService, a second CacheTags).
 */
export * from './lib/api-base-url';
export * from './lib/api/cache-tags';
export * from './lib/api/errors';
export * from './lib/api/graphql-client';
export * from './lib/auth/auth.interceptor';
export * from './lib/auth/auth.store';
export * from './lib/format';
export * from './lib/ui/avatar';
export * from './lib/ui/button';
export * from './lib/ui/card';
export * from './lib/ui/error-state';
export * from './lib/ui/segmented-tabs';
export * from './lib/ui/skeleton';
export * from './lib/ui/star-rating';
export * from './lib/ui/toast';
