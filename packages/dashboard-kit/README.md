# @ermulaku/dashboard-kit

Runtime code shared by the tutor dashboard ([`apps/dashboard-ng`](../../apps/dashboard-ng)) and
its micro frontends ([`apps/dashboard-reviews`](../../apps/dashboard-reviews)): the auth store and
interceptor, `GraphqlClient`, `CacheTags` / `cachedQuery`, `errorMessage`, formatting helpers,
`ToastService`, the UI primitives the remotes render, and the `API_BASE_URL` token.

- **Source, not a built package.** `tsconfig.base.json` maps `@ermulaku/dashboard-kit` to
  `src/index.ts`; each app's Angular build compiles it. No build step, no ng-packagr.
- **One instance at runtime.** Native Federation shares it as a singleton _shared mapping_
  (`federation.config.mjs` in both apps), so there is one `ToastService`, one `CacheTags`, one
  auth store across the shell and its remotes. That works only through the barrel: import
  `@ermulaku/dashboard-kit`, never a path inside it.
- **No build-time config.** The API origin comes from the `API_BASE_URL` token, which each app
  provides — never from one app's `define`.
- **Tests** run in the dashboard's Karma build (`apps/dashboard-ng/angular.json` → `test.include`).
- **A contract:** the shell's copy is the one that runs, so a change must stay compatible with
  the deployed remote until both have redeployed (see `docs/MICRO_FRONTENDS.md` §4).
