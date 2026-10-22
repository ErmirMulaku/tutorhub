# Dashboard → Angular: CV bullets and interview Q&A

Everything here is backed by something in this repo — a commit, a test, or a measurement in
[`DASHBOARD_ANGULAR_MIGRATION.md`](./DASHBOARD_ANGULAR_MIGRATION.md) (§7 results, §8 parity,
§9 cutover). If a number is quoted, that document says how it was measured.

## CV bullets

- **Migrated a production React/Redux tutor dashboard to Angular 22 (zoneless, signals, NgRx)**
  feature by feature — 11 screens + onboarding, every API call kept identical, React live until a
  documented, reversible cutover.
- **Cut the JavaScript loaded up front by 26 %** (131 → 97.5 kB gzip) with route-level lazy loading
  and by removing Redux DevTools from production builds; enforced with bundle budgets that fail the
  build. Lighthouse, mobile dashboard, same run: performance 86 (React) → 93 (Angular).
- **Removed a layout shift present in both apps (CLS 0.188 → 0.003)** by reading the trace's
  layout-shift rects rather than trusting the first diagnosis, and raised text contrast to WCAG AA
  across both themes (accessibility 91 → 100 in dark mode).
- **Built the test suite from scratch: 128 Jasmine/Karma specs and 10 Cypress E2E tests** against a
  fixture API — NgRx reducers/effects (incl. marble tests), HTTP interceptors, guards, `fakeAsync`
  components — and mutation-tested it: 11 planted bugs, each failing exactly its spec (one first
  exposed a spec that passed for the wrong reason, which was rewritten).
- **Caught three release blockers before the first deploy:** a lockfile that installed on macOS
  but not on Linux (CI, Docker, Vercel), an API Dockerfile missing a workspace manifest, and an Nx
  cache that would ship a stale build-time `API_URL`.

## Interview questions

**Why migrate a working app, and how did you avoid a big-bang rewrite?**
The goal was hands-on Angular depth on a real product. I ran the Angular app beside the React one
on the same API and seed data, one feature per phase, and compared them screen by screen (same
numbers, same requests). React stayed in production until the end; the cutover is a Vercel setting
plus one merge, with a tagged rollback.

**When did you use NgRx, and when not?**
Only for state that many parts of the screen share or that changes from outside the screen:
session, UI preferences, bookings (an entity adapter, patched live by Socket.IO) and the dashboard
summary that feeds sidebar badges. "Fetch, show, save" screens use a typed service with Angular's
`rxResource`. Putting every endpoint in NgRx would have been ceremony without benefit.

**How did you replace RTK Query's cache invalidation?**
A tiny `CacheTags` service with the same tag names as the React `api.ts`. Mutations call
`invalidate('Booking', …)` with exactly the tags React listed in `invalidatesTags`; queries reload
when their tags fire. One honest difference: RTK served a still-fresh cache on remount, this
refetches — simpler, never stale.

**What does zoneless mean for testing?**
Two things bit me. First, `fakeAsync` needs zone.js, but the moment the builder sees zone.js it
quietly switches _every_ TestBed to zone change detection — tests no longer matched the app. A
global `beforeEach` restores zoneless. Second, a loading resource is a pending task, so
`whenStable()` waits for data — with a fake request that never answers, it hangs.

**`switchMap` vs `mergeMap` — where and why?**
Loading a calendar week uses `switchMap`: paging quickly cancels the stale request (observed in the
browser: 4 started, 3 aborted). Accept/decline uses `mergeMap`: accepting one lesson must not cancel
declining another. Both are proven with marble tests, which make the timing exact.

**Tell me about a bug your tests found that you'd have missed.**
Removing the React app made `packages/ui`'s tests fail: they used `@testing-library/dom`, a peer
dependency only the React app declared — a phantom dependency hidden by npm's hoisting. And a
`MockStore.overrideSelector` leaked between specs because it patches the shared selector itself.

**How do you know your tests are any good?**
I plant bugs. A script changed one thing at a time — `switchMap` to `mergeMap`, no sign-out on 401,
dollars instead of cents, a socket left open — and each made exactly the intended spec fail. One
didn't: a "theme survives sign-out" spec passed anyway because the default theme follows the OS and
my machine was dark. I rewrote it.

**You were asked to use `@defer`. Did you?**
I measured it and reverted it. Deferring the charts split them out, but put the deferrable-views
runtime into the core chunk every page loads: +3.9 kB up front to save 1.4 kB that was already
lazy with its route. `@defer` pays off for heavy, rarely-shown blocks inside an eagerly loaded view;
here every route was already lazy.

**What did the bundle analysis turn up?**
Redux DevTools were shipping to every visitor: `logOnly: !isDevMode()` is a runtime switch, so the
code is always bundled. File replacement makes them development-only — −4.8 kB gzip up front.

**How did you fix the layout shift?**
Lighthouse said the KPI row shifted, and its skeletons were indeed the wrong height — but the
trace's rects showed the row moving _up_ 155 px, not growing: the setup banner rendered while
"published" was still unknown, then vanished. Both are fixed, and a spec renders a real KPI card
under the real CSS to keep the skeleton height honest. I also had to slow the API on purpose:
locally the data often arrived before the first paint, so CLS swung between 0 and 0.19.

**How did you approach accessibility?**
Tokens, not elements. The tertiary-text token was 2.2:1 in light mode — invisible to Lighthouse at
first because my machine ran it in dark mode. Fixing the token fixed sidebar labels, chart axes and
table headers at once. The remaining failures are brand colours (the teal is 3.95:1), which I
listed as a design decision instead of quietly changing.

**How did you plan the cutover and rollback?**
Tag `dashboard-react-final` on what production runs; change the Vercel Root Directory; prove the
build with a preview deployment (Vercel only pins the Node major, and Angular 22 needs ≥ 22.22.3);
merge; smoke test. Rollback is Vercel's Instant Rollback, or the Root Directory back plus a
workflow run on the tag.

**What would you do differently?**
Run CI from the first commit — the Linux-only lockfile failure was there from the moment the
Angular dependencies were added, unnoticed because nothing had been pushed. Choose Vitest over Karma for anything long-lived (Karma is deprecated; I chose it to
learn it). And pin the Node patch in one place for every tool.
