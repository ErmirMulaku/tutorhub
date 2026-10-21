# Dashboard → Angular migration plan

Migrating the tutor dashboard (`apps/dashboard`: React 19 + Redux Toolkit + RTK Query + a
hand-written Webpack 5 build) to **Angular** as a new app at `apps/dashboard-ng`, **one feature at a
time**. The React app stays live and untouched until the cutover phase (Phase 9).

- **Branch:** `feat/dashboard-angular-migration`, one commit (or a few) per phase, no push/deploy
  until asked.
- **Same behaviour, same API calls.** Every GraphQL document and REST call is copied verbatim from
  `apps/dashboard/src/store/api.ts`. `services/api` is not changed unless it becomes truly
  necessary, and then only after asking first.
- **Goal:** hands-on experience with Angular, Angular CLI, RxJS, NgRx, Jasmine, Karma and Cypress.

---

## 1. What the React app is today (inventory)

| Area               | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry / routes     | `main.tsx` (Provider + BrowserRouter), `app/App.tsx` (3 public routes + 11 routes in an `AppShell` layout, `*` → `/dashboard`), `app/nav.ts` (nav groups + page titles), `app/use-theme.ts` (writes `data-theme` / `data-accent` on `<html>`)                                                                                                                                                                                                                        |
| State              | `store/auth-slice.ts` (`token`, `tutorId`, persisted to `localStorage`), `store/ui-slice.ts` (theme, accent, online, sidebar drawer, New-lesson modal, legacy `selectedTutorId`), `store/store.ts` (listener that **resets the whole API cache** on sign-in / sign-out)                                                                                                                                                                                              |
| Data layer         | `store/api.ts` — one RTK Query API, **54 endpoints** (50 GraphQL, 4 REST), 14 cache tags. A custom base query handles REST + GraphQL, unwraps `data`, turns `errors` into an error, and **clears the session on HTTP 401 or a GraphQL error matching `/token\|unauth/i`**                                                                                                                                                                                            |
| Auth (pre-store)   | `features/auth/api.ts` — a raw `fetch` GraphQL POST **without** a token for `tutorSignin`, `tutorSignup`, `tutorVerifyEmail`, `resendTutorVerificationCode`                                                                                                                                                                                                                                                                                                          |
| Live               | `features/live/socket.ts` (`io(API_URL, { transports: ['polling', 'websocket'] })` — polling first on purpose, App Runner rejects WS upgrades), `use-live-bookings.ts` (mounted in `AppShell`, `subscribeTutor` → on `bookingChanged` invalidate `Booking`/`DashboardSummary`/`Notifications`), `use-live-messages.ts` (mounted in Messages only, `subscribeMessages` → on `messageReceived` invalidate `Message`/`Conversation`/`DashboardSummary`/`Notifications`) |
| Shared UI          | `components/`: AreaChart (SVG), BarChart (flex), CodeChip, KPIStat, NotificationsBell, SegmentedTabs, Sidebar, StatusPill, ToastProvider (context, 2.5 s auto-dismiss), ToggleSwitch, Topbar, icons. Plus 6 React primitives from `@ermulaku/ui`: `Avatar`, `Button`, `Card`, `Modal`, `Skeleton`, `StarRating`                                                                                                                                                      |
| Helpers            | `lib/format.ts` (`money`, `timeOf`, `dayOf`, `statusTone`, `STATUS_LABEL`), `lib/validation.ts` (`isValidEmail`, `passwordError`)                                                                                                                                                                                                                                                                                                                                    |
| Styling            | `src/styles.css` (2,335 lines, global BEM-ish classes, 4 breakpoints) on top of `@ermulaku/ui/styles.css` (tokens, `[data-theme]`, `[data-accent]`, `.th-*` classes, keyframes). Font: Hanken Grotesk from Google Fonts                                                                                                                                                                                                                                              |
| Tests (Jest + RTL) | `store/ui-slice.test.ts`, `store/auth-cache-reset.test.ts`, `features/onboarding/OnboardingRoute.test.tsx`, `features/availability/days.test.ts`, `features/availability/WeekCalendar.test.tsx`                                                                                                                                                                                                                                                                      |
| Build / deploy     | `webpack.config.mjs` (ts-loader, CSS extract, SVGR, `splitChunks`, `DefinePlugin` for `API_URL`, dev server :3100, bundle analyzer), `vercel.json` (`nx build dashboard`, `dist`, SPA rewrite, immutable asset caching), `.github/workflows/deploy-dashboard.yml` (Vercel CLI from repo root, triggered on `apps/dashboard/**`)                                                                                                                                      |

**Dead code found (not routed anywhere):** `features/availability/CalendarView.tsx`,
`WeekCalendar.tsx`, `WorkingHoursEditor.tsx`, `features/bookings/BookingsList.tsx`,
`features/tutors/TutorSelect.tsx`, the 4 REST endpoints they use (`getTutors`, `getBookings`,
`updateBookingStatus`, `updateTutorHours`) and `ui.selectedTutorId`. They are leftovers from the
Phase 4 dashboard. **Plan: do not port them** (no user-visible behaviour is lost). `days.ts` and its
test only serve that dead code, so they are not ported either; `WeekCalendar.test.tsx` is replaced by
real Angular component tests in Phase 7.

---

## 2. Feature table — React → Angular

Every route is lazy-loaded (`loadComponent`). "NgRx" means the data lives in the global store;
otherwise the screen uses a typed `HttpClient` service + RxJS/signals in the component.

| React route / feature | Angular route                                                             | Angular components                                                                                               | Service(s)                                                                    | NgRx?                                                                                     | Phase                         |
| --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `AppShell` layout     | `''` layout route, `canActivate: [authGuard]`, children lazy              | `ShellComponent`, `SidebarComponent`, `TopbarComponent`, `ToastHostComponent`                                    | `ToastService`, `ThemeService` (effect → `<html>` attributes)                 | **Yes** — `ui` feature (theme, accent, online, sidebar, newLessonOpen)                    | 2                             |
| `/login`              | `login` (no guard — as in React)                                          | `LoginPageComponent`, `VerifyPanelComponent`                                                                     | `AuthApiService` (no token, see risks)                                        | **Yes** — `auth` feature (`setCredentials`)                                               | 2                             |
| `/signup`             | `signup` (no guard — as in React)                                         | `SignupPageComponent`, `VerifyPanelComponent`                                                                    | `AuthApiService`                                                              | **Yes** — `auth`                                                                          | 2                             |
| `/onboarding`         | `onboarding` (`authGuard`, `notPublishedGuard` → `UrlTree('/dashboard')`) | `OnboardingWizardComponent` (reuses `NewServiceModal`, `WeeklyHoursEditor`, `PayoutEditor`)                      | `SettingsService`, `CatalogService`, `AvailabilityService`, `EarningsService` | No                                                                                        | 2 (route + guard), 5 (wizard) |
| `/dashboard`          | `dashboard`                                                               | `DashboardPageComponent`, `KpiStatComponent`, `ScheduleRowComponent`, `StatusPillComponent`, setup banner        | `BookingsApiService`, `DashboardApiService`, `ReviewsService`                 | **Yes** — `bookings` (today's schedule) + `dashboard` (summary, `meTutor`, notifications) | 3                             |
| `/lessons`            | `lessons` (`?status=` / `?q=` query params)                               | `LessonsPageComponent`, `SegmentedTabsComponent`                                                                 | `BookingsApiService`                                                          | **Yes** — `bookings` entity adapter, accept/decline/complete effects                      | 3                             |
| `NewLessonModal`      | (shell-wide, opened from Topbar)                                          | `NewLessonModalComponent`                                                                                        | `BookingsApiService`                                                          | Yes — `ui.newLessonOpen` + `bookings` `createLesson` effect                               | 3                             |
| `NotificationsBell`   | (Topbar)                                                                  | `NotificationsBellComponent` (outside-click via `HostListener`)                                                  | `DashboardApiService`                                                         | Yes — `dashboard.notifications`                                                           | 4                             |
| Live bookings         | (shell-wide)                                                              | —                                                                                                                | `LiveSocketService` (socket.io-client → Observables)                          | Yes — effect maps `bookingChanged` → reload actions                                       | 4                             |
| `/messages`           | `messages`                                                                | `MessagesPageComponent` (thread list, bubbles, composer)                                                         | `MessagingService`, `LiveSocketService`                                       | No — component state with signals + RxJS                                                  | 4                             |
| `/calendar`           | `calendar`                                                                | `CalendarPageComponent`, `MonthGridComponent`, `TimeGridComponent`                                               | `BookingsApiService` (range)                                                  | Yes — `bookings` `loadRange` (upsert into the same entity state)                          | 5                             |
| `/availability`       | `availability`                                                            | `AvailabilityPageComponent`, `WeeklyHoursEditorComponent` (Reactive `FormArray`), booking rules + time-off forms | `AvailabilityService`                                                         | No                                                                                        | 5                             |
| `/catalog`            | `catalog`                                                                 | `CatalogPageComponent`, `ServiceCardComponent`, `NewServiceModalComponent` (Reactive form)                       | `CatalogService`                                                              | No                                                                                        | 5                             |
| `/settings`           | `settings`                                                                | `SettingsPageComponent` (Profile / Payout / Notifications tabs), `DeleteAccountCardComponent`                    | `SettingsService`, `EarningsService`                                          | No (dispatches `clearCredentials` on delete)                                              | 5                             |
| `/earnings`           | `earnings`                                                                | `EarningsPageComponent`, `BarChartComponent`, `ConnectPayoutsComponent`, `PayoutEditorComponent`                 | `EarningsService`                                                             | No                                                                                        | 6                             |
| `/marketing`          | `marketing`                                                               | `MarketingPageComponent`, `PromoCardComponent`, `CodeChipComponent`, new-promotion modal (Reactive form)         | `MarketingService`                                                            | No                                                                                        | 6                             |
| `/reviews`            | `reviews`                                                                 | `ReviewsPageComponent`, `ReviewCardComponent`                                                                    | `ReviewsService`                                                              | No (filter → `switchMap`)                                                                 | 6                             |
| `/analytics`          | `analytics`                                                               | `AnalyticsPageComponent`, `AreaChartComponent`, `BarChartComponent` (`@defer`)                                   | `AnalyticsService`                                                            | No                                                                                        | 6                             |
| `*`                   | `**` → `redirectTo: 'dashboard'`                                          | —                                                                                                                | —                                                                             | —                                                                                         | 2                             |

**`@ermulaku/ui` replacements** (that package is React-only, so it is not used): small standalone
Angular components that render the **same `.th-*` markup and classes**, so the shared CSS applies
unchanged — `button[thButton]` (attribute component: `variant` / `size` / `block` inputs → host
classes), `th-card`, `th-avatar` (same `initials()` logic), `th-skeleton`, `th-star-rating`,
`th-modal` (Escape, backdrop click, body scroll lock, focus return, 200 ms exit — hand-written, no
CDK dependency). Built in Phase 2 (Button/Card/Avatar/Skeleton) and Phase 3/5 (StarRating/Modal) as
they are first needed.

**Why NgRx only for `auth`, `ui`, `bookings`, `dashboard`:** these are the pieces read from many
places at once (sidebar badges, topbar, live socket, several screens) and mutated by events from
outside the screen (WebSocket). The other screens are "fetch, show, save" — a typed service plus
RxJS in the component is the idiomatic Angular answer there, and putting every endpoint into NgRx
would be ceremony without benefit. (That trade-off is itself a good interview answer.)

**Replacing RTK Query's tag invalidation:** a tiny `CacheTags` service — `invalidate(...tags)`
emits on a `Subject`; a screen's data stream is
`cacheTags.on('Earnings').pipe(startWith(null), switchMap(() => api.summary()))`. Mutations call
`invalidate` with the **same tags `api.ts` lists in `invalidatesTags`**, so refetch behaviour
matches. NgRx effects listen to the same tags for the four store features. Sign-in / sign-out reset
both (NgRx meta-reducer + `CacheTags.invalidateAll()`), porting the `store.ts` listener.

---

## 3. Concept mapping — React → Angular

| React / Redux                                                           | Angular                                                                                                                                                                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSlice` (`auth-slice`, `ui-slice`)                                | `createActionGroup` (actions) + `createFeature` / `createReducer` + `on(...)` (reducer + auto-generated selectors). `localStorage` writes move out of the reducer into an **effect** (reducers stay pure)      |
| `configureStore` + `<Provider>`                                         | `provideStore({...})`, `provideEffects([...])`, `provideStoreDevtools()` in `app.config.ts`                                                                                                                    |
| `createListenerMiddleware` (cache reset on auth change)                 | a **meta-reducer** (resets feature state on `setCredentials` / `clearCredentials`) + an effect calling `CacheTags.invalidateAll()`                                                                             |
| `createAsyncThunk` / RTK Query endpoint                                 | an **effect** (`createEffect(() => actions$.pipe(ofType(load), switchMap(() => api.get().pipe(map(success), catchError(() => of(failure))))))`) + a typed **`HttpClient` service**                             |
| RTK Query cache (normalised list)                                       | `@ngrx/entity` `createEntityAdapter<TutorBooking>()` → `setAll` / `upsertMany` / `updateOne` + `selectAll`                                                                                                     |
| `providesTags` / `invalidatesTags` / `api.util.invalidateTags`          | `CacheTags` service (Subject of tags) + `switchMap` refetch; same tag names                                                                                                                                    |
| `fetchBaseQuery` + `prepareHeaders` (Bearer token)                      | functional `HttpInterceptorFn` (`authInterceptor`) reading the token via `store.selectSignal`                                                                                                                  |
| base-query `401 → clearCredentials`                                     | same interceptor: `catchError` on `status === 401` → `store.dispatch(clearCredentials())`; GraphQL-level auth errors handled in `GraphqlClient` (they arrive as HTTP 200)                                      |
| GraphQL via base query (`{ graphql: { document, variables } }`)         | `GraphqlClient.request<T>(document, variables)` — a plain `http.post('/graphql')` that unwraps `data` / throws on `errors` (no Apollo)                                                                         |
| `useSelector(s => s.auth.token)`                                        | `store.select(selectToken)` (Observable, `async` pipe) **or** `store.selectSignal(selectToken)` (signal, read as `token()` in templates)                                                                       |
| `useDispatch()(action)`                                                 | `inject(Store).dispatch(action)`                                                                                                                                                                               |
| `useState`                                                              | `signal()`; derived values with `computed()`                                                                                                                                                                   |
| `useEffect` (side effect on change)                                     | `effect()` for signal-driven DOM work; RxJS pipelines for data; `DestroyRef` / `takeUntilDestroyed()` for cleanup                                                                                              |
| `useMemo`                                                               | `computed()`                                                                                                                                                                                                   |
| Props / callbacks                                                       | `input()` / `input.required()` / `output()`; two-way with `model()`                                                                                                                                            |
| `children` / render slots                                               | content projection `<ng-content>` (`th-card`, `th-modal`)                                                                                                                                                      |
| JSX `cond && <X/>`, `.map()` with `key`                                 | `@if` / `@else`, `@for (x of xs; track x.id)`, `@switch`                                                                                                                                                       |
| React Router `<Routes>` / `<Route>`                                     | `Routes` array in `app.routes.ts` + `provideRouter(routes, withComponentInputBinding())`                                                                                                                       |
| `<Route element={<AppShell/>}>` + `<Outlet/>`                           | a layout route with `children` + `<router-outlet />` in `ShellComponent`                                                                                                                                       |
| `<Navigate to="/login" />` in `AppShell` / `OnboardingRoute`            | functional guards (`CanActivateFn`) returning `true` or a `UrlTree`                                                                                                                                            |
| `NavLink` + `isActive`                                                  | `routerLink` + `routerLinkActive="sidebar__link--active"`                                                                                                                                                      |
| `useNavigate`, `useLocation`, `useSearchParams`                         | `Router.navigate[ByUrl]`, `Router.events` / `toSignal`, `ActivatedRoute.queryParamMap` (or `input()` via component input binding)                                                                              |
| Static imports (one bundle + vendor split)                              | `loadComponent: () => import('./features/x/x.page').then(m => m.XPage)` — one lazy chunk per route                                                                                                             |
| `ToastProvider` + `useToast` (Context)                                  | `ToastService` (`providedIn: 'root'`, signal list) + `ToastHostComponent` rendered in the shell                                                                                                                |
| Controlled inputs (`value` + `onChange`)                                | **Reactive Forms** (`FormGroup`, `FormArray`, `Validators`, `nonNullable` builder)                                                                                                                             |
| `features/live/socket.ts` + `useLiveBookings` / `useLiveMessages` hooks | `LiveSocketService`: wraps socket.io-client in `Observable`s (`fromEvent`-style, teardown closes the socket), `connect$`/reconnect re-emits `subscribeTutor`, consumers unsubscribe via `takeUntilDestroyed()` |
| Webpack `DefinePlugin` (`API_URL` at build time)                        | `environment.ts` defaults + the application builder's **`define`** option (`ng build --define`) fed from `process.env.API_URL` in the build script                                                             |
| Webpack config (loaders, splitChunks, dev server, analyzer)             | `angular.json` (`@angular/build:application`, esbuild + Vite dev server); `ng build --stats-json` + `esbuild` analyzer for bundle analysis                                                                     |
| Jest + `@testing-library/react` (jsdom)                                 | **Jasmine** (`describe`/`it`/`expect`, `jasmine.createSpyObj`) on **Karma** in a real (headless) Chrome; `TestBed`, `ComponentFixture`                                                                         |
| `jest.unstable_mockModule`                                              | dependency injection: `{ provide: X, useValue: fake }` in `TestBed`; `provideMockStore`, `provideMockActions`, `HttpTestingController`                                                                         |
| Jest fake timers                                                        | `fakeAsync` + `tick()` (needs `zone.js/testing` in the **test** polyfills only — see §5)                                                                                                                       |
| Cypress (marketplace)                                                   | Cypress in `apps/dashboard-ng/cypress`, `cy.intercept` fixtures (no real API)                                                                                                                                  |

---

**Implementation notes (Phase 2):**

- **No `guestGuard`.** The plan above first listed one on `/login` and `/signup`, but the React app
  lets a signed-in tutor open both, so adding a redirect would change behaviour. Dropped.
- **Sign-out redirect is an NgRx effect.** React re-rendered `<Navigate to="/login">` whenever the
  token became `null`; Angular guards only run on navigation, so `clearCredentials` (sign-out,
  account deletion, 401, GraphQL auth error) navigates to `/login` from an effect.
- **`/onboarding` is behind `authGuard`.** React left it unguarded, so a signed-out visitor hit
  401s there; now they go to `/login` first. No change for signed-in tutors.
- **Attribute components** (`<button th-button>`, `<aside th-sidebar>`, `<header th-topbar>`,
  `<svg th-icon>`) keep the native element, so the verbatim CSS (e.g.
  `.topbar__actions > .th-btn`) and the native semantics still apply.
- **Reactive Forms add `novalidate`**; the auth forms set `ngNativeValidate` to keep React's
  browser-native `required` / `type=email` / `minlength` checks.

**Implementation notes (Phase 3):**

- **Where data lives.** NgRx holds what several parts of the screen share or what effects
  change: `bookings` (entity adapter: lessons + today's schedule) and `dashboard` (`meTutor`, the
  KPI summary that also drives the sidebar badges, the published flag). The sidebar — present on
  every shell page — keeps `dashboard` loaded, so the dashboard screen reads it instead of fetching
  again. Everything else is a component-scoped `cachedQuery` (Angular's `rxResource` + tags).
- **Tags, same names as `api.ts`.** Each service mutation calls `CacheTags.invalidate(...)` with
  exactly the tags its React endpoint listed in `invalidatesTags`; `loadOnTags` (NgRx) and
  `cachedQuery` (resources) reload while their component is alive — RTK's "active subscriptions
  refetch on invalidation".
- **One honest difference:** RTK Query serves a still-fresh cache entry when a screen re-mounts;
  here a screen fetches again on mount. Simpler, never stale, one extra request per visit.
- **Account switch** is handled by a meta-reducer that drops every data slice on
  `setCredentials` / `clearCredentials` (port of the `store.ts` listener).

**RTK Query hook → NgRx effect + selector (the Lessons list):**

| Step               | React (RTK Query)                                                              | Angular (NgRx)                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Define the request | `getTutorBookings: build.query({ query: () => ({ graphql: … }) })`             | `BookingsApi.tutorBookings()` — `HttpClient` via `GraphqlClient`                                                          |
| Trigger it         | calling `useGetTutorBookingsQuery()` in the component                          | `loadOnTags(['Booking'], () => BookingsActions.loadLessons())`                                                            |
| Run it             | RTK Query middleware                                                           | `loadLessons` effect: `ofType(loadLessons) → switchMap(api) → map(success) / catchError(failure)`                         |
| Store the result   | the `api` slice's cache entry                                                  | `loadLessonsSuccess` → `bookingsAdapter.upsertMany` + `lessonIds`                                                         |
| Read it            | `const { data, isLoading } = useGetTutorBookingsQuery()`                       | `store.selectSignal(bookingsFeature.selectLessons)` / `selectLessonsStatus`                                               |
| Mutate             | `const [accept] = useAcceptBookingMutation(); accept(id).unwrap().then(toast)` | `dispatch(changeStatus({ booking, transition: 'accept' }))` → effect → `changeStatusSuccess` → `updateOne` + toast effect |
| Refresh after      | `invalidatesTags: ['Booking', 'DashboardSummary', 'Notifications']`            | `CacheTags.invalidate('Booking', 'DashboardSummary', 'Notifications')` in the service                                     |

**Implementation notes (Phase 4):**

- **`LiveSocketService`** returns _cold_ Observables: subscribing opens a socket.io connection
  (same `['polling', 'websocket']` transports), joins the room on every `connect` — which
  socket.io also fires after each automatic reconnect, so rooms are rejoined by themselves — and
  unsubscribing closes it. Components subscribe with `takeUntilDestroyed()`, the counterpart of the
  React hooks' cleanup. The `io()` call sits behind an `InjectionToken` so tests can pass a fake.
- **Same two connections as React:** bookings in the shell, messages only on the Messages screen.
- **`bookingChanged` → NgRx:** a `liveChanged` action patches the booking already in the entity
  state at once (status + times), and an effect invalidates `Booking` / `DashboardSummary` /
  `Notifications` exactly like the React hook, so lists and KPIs refetch a moment later.
- **Notifications** live in the NgRx `dashboard` feature (the bell is on every page).

**Senior-review cleanup (between Phases 4 and 5):**

- **Errors are visible — a deliberate improvement over React**, which left a failed query as an
  endless skeleton or an empty list and failed mutations silently. Failed loads (KPIs, today's
  schedule, lessons, conversations) show an `ErrorState` with Retry; a failed booking update shows
  a toast; a failed message send restores the draft and says why. One shared `errorMessage()`.
- **No `effect()` writes state any more.** New-lesson defaults are `linkedSignal`s derived from the
  loaded lists; mark-as-read is `toObservable(active) → filter → exhaustMap`, which also stops a
  double request when a live refetch re-emits the same unread thread. The remaining effects only
  sync the DOM (theme attributes, modal timing, scroll lock).
- **Route-level state.** `bookings` and `dashboard` (reducers, effects, `@ngrx/entity`) are
  registered in the providers of the lazy shell route (`loadChildren` → `shell.routes.ts`), so
  login and sign-up never download them. Initial transfer 104.8 → 100.9 kB.
- Verified by stopping the API mid-session: the error state appeared, Retry recovered once the API
  was back, and — after socket.io's automatic reconnect — a live change still arrived, proving the
  room is rejoined on reconnect.

**Implementation notes (Phase 5):**

- **Typed Reactive Forms everywhere data is edited**: weekly hours (a `FormArray` of seven
  `FormGroup`s with a per-day end-after-start validator), booking rules, time off, new service,
  settings profile (incl. a real IANA-timezone check), onboarding profile, payout method.
  `FieldError` shows a control's first error once touched; it listens to `control.events`
  because form state is not a signal. `ToggleSwitch` is a `ControlValueAccessor`, so it works as
  `formControlName` and as a stand-alone `[(checked)]`.
- **RxJS where it fits:** the calendar window is `combineLatest(view, anchor)` → `rangeFor` →
  `distinctUntilChanged`, merged with the `Booking` tag; the fetch is a `switchMap` effect —
  paging fast aborts the stale requests (observed: 4 started, 3 aborted, 1 rendered). Notification
  toggles are optimistic with `concatMap` (saves stay in click order) and roll back on error.
- **Deliberate differences from React (improvements, each verified in the browser):**
  1. **Inline validation** — React only had `min` attributes; invalid forms now block the save
     and say why.
  2. **Calendar DST fix** — React stepped days as `midnight + i × 24h`; on the 25-hour
     25 Oct 2026 fall-back day every later date shifts, so React's October month page shows
     **"25" twice** and ends a day early (seen live). `addDays()` uses calendar arithmetic, and a
     spec guards it.
  3. **Toasts work outside the shell** — React's `ToastProvider` sat inside `AppShell`, so
     onboarding's toasts silently did nothing. The toast host is now in the app root, layered
     above the onboarding overlay.
  4. **Live search on /lessons** — typing in the topbar while on Lessons updates `?q=`
     (`debounceTime(300)` + `distinctUntilChanged`: 6 input events → 1 navigation). Elsewhere it
     still searches on Enter, as React did.
- **Pre-existing API bug found — fixed in `8136a7f` (`fix(api)`), with approval:**
  `addTimeOff` always fails with `Bad Request Exception`. The global `ValidationPipe` uses
  `forbidNonWhitelisted`, but `TimeOffInput.startDate` / `endDate` carry no class-validator
  decorators, so they're rejected as unknown properties. Reproduced with React's exact request via
  `curl`; React hid it (no error handling). Fixed with `@IsDate()` + a server-side
  end-before-start rule; `main.ts` and all e2e suites now share one `createValidationPipe()`
  (most suites had been running without `forbidNonWhitelisted`, which is how it slipped through).

**Implementation notes (Phase 6):**

- **Charts without a library.** `AreaChart` is an attribute component on the SVG itself
  (`<svg th-area-chart [points]>`; children use the `svg:` prefix) whose geometry is one
  `computed()`. Each instance gets its own gradient id — React's fixed `areaFill` id would make
  two charts on one page share a gradient. `BarChart` is the same flex columns as React. Both
  expose an `aria-label` summary of the data.
- **No NgRx here, as planned.** Earnings (3 queries), Marketing (3), Reviews (2) and Analytics (5)
  are `cachedQuery`s under the tag React used. The Reviews tab is the query's `params`, React's
  `useGetMyReviewsQuery(filter)`. Mutations invalidate the same tags as `api.ts`. Observed: one
  `replyToReview` → exactly three refetches (notifications, summary, list).
- **Deliberate differences (improvements, each verified in the browser):**
  1. **CSV export quotes fields (RFC 4180) and defuses spreadsheet formulas** — React joined raw
     values, so a comma in a name shifted the columns. Spec'd in `transactions-csv.spec.ts`.
  2. **"Copied" only when the copy happened.** React toasted "Copied" even when the Clipboard API
     was missing or denied; the chip now says it couldn't copy (seen with the pane's denied
     permission, and the success path with a stubbed clipboard).
  3. **New-promotion validation** mirrors the API's class-validator rules (name ≥ 2, code ≥ 3,
     value ≥ 1) plus "at most 100 %" for percent. The form holds the number the tutor typed:
     React kept cents in the form and divided for display, so switching 15 % to Fixed showed $0.15.
     $12.50 is stored as **1250 cents**.
  4. **Failed mutations say why** (withdraw, end promotion, reply, create). Locally, withdraw is
     refused with "Connect payout onboarding is not complete" for the seed tutor — React gives no
     feedback at all.
  5. A review reply also posts on Enter.
- **Bug found and fixed (Angular-side, present since Phase 2):** `Card`'s `:host { display: block }`
  compiles to an attribute selector that loads after the global stylesheet and has the same
  specificity as a class, so it beat the screens' own classes: Messages lost its two-pane grid
  (`.chat`), and the Catalog cards (`.svc`), stat cards (`.earn__stat`) and review summary
  (`.rev-summary`) lost their flex/grid layout. Host display now lives in `styles/_hosts.scss` as
  element selectors, which every class outranks — exactly as on React's `<div>`.
- **Parity quirks kept (for the Phase 8 list):** `money()` rounds to whole dollars, so a $12.50
  promotion reads "$13 off" in both apps; the "Withdraw now" label disappears on hover in both
  apps (shared CSS).

## 4. Phase order

| Phase | Scope                                                                                                                                                                                                                 | Done when                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0     | This plan + version check (no code)                                                                                                                                                                                   | Plan approved                                                                   |
| 1     | `ng new`-style scaffold at `apps/dashboard-ng` (standalone, SCSS, routing, `--test-runner=karma`), package scripts for Nx, environments + `API_URL`, `@ermulaku/types`, ported tokens + global styles, headless Karma | `nx run-many` green incl. the new project; empty app renders with the same look |
| 2     | Shell (Sidebar, Topbar, theme/accent, toasts), auth (login, signup, verify, onboarding route), NgRx `auth` + `ui`, interceptor, guards, every route lazy (stub pages)                                                 | Sign in → shell → navigate; build output shows one lazy chunk per route         |
| 3     | `HttpClient` REST + GraphQL services for all of `api.ts`, NgRx `bookings` (entity adapter) + `dashboard`, Dashboard home + Lessons + New-lesson modal                                                                 | Same KPIs / lessons / accept-decline-complete as React against the seed         |
| 4     | `LiveSocketService`, `bookingChanged` → NgRx, NotificationsBell, Messages with live `messageReceived`                                                                                                                 | An external curl change appears live in both apps                               |
| 5     | Reactive Forms: Availability, Catalog, Settings, Onboarding wizard; Calendar (Day/Week/Month); `debounceTime`/`switchMap`/`combineLatest` where they fit (topbar search, lessons filters)                             | Forms validate + persist; calendar matches React                                |
| 6     | `AreaChart` / `BarChart` as SVG/flex components, Earnings, Marketing, Reviews, Analytics                                                                                                                              | Every React route has an Angular equivalent                                     |
| 7     | Jasmine/Karma ports + new tests (reducers, selectors, effect, service, interceptor, guards, socket, `fakeAsync` component), Cypress E2E with fixtures, CI job                                                         | All green locally and in CI                                                     |
| 8     | Budgets, OnPush everywhere, `@for … track`, `@defer` for charts; bundle size + Lighthouse vs React; parity checklist                                                                                                  | Numbers recorded below; gaps listed                                             |
| 9     | **Only on request:** tag `dashboard-react-final`, point deploy at `dashboard-ng`, remove `apps/dashboard` in its own commit, docs, CV bullets + interview Q&A                                                         | Production serves the Angular app                                               |

---

## 5. Version compatibility (checked 2026-10-21 with `npm view`)

| Tool                                             | Version                                                                                             | Requirement                                                         | Status in this repo                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular (`@angular/core`, CLI, `@angular/build`) | **22.2.3** (latest stable)                                                                          | TypeScript `>=6.0 <6.1`                                             | ✅ root TypeScript is **6.0.3**                                                                                                                                  |
| Angular engines                                  | —                                                                                                   | Node **`^22.22.3`** \|\| `^24.15.0` \|\| `>=26`                     | ⚠️ **local Node is 22.22.2** (one patch too old). CI (`setup-node` `22`) and Vercel (`22.x`) resolve the newest 22.x, so they are fine                           |
| NgRx (`store`, `effects`, `entity`)              | **22.0.1**                                                                                          | `@angular/core ^22`, `rxjs ^7.5`                                    | ✅ `rxjs@7.8.2` is already in the tree (from the API)                                                                                                            |
| Nx                                               | 23.0.0 (root)                                                                                       | —                                                                   | ✅ no `@nx/angular` plugin needed — Nx infers `build`/`test`/`lint`/`typecheck` from `package.json` scripts, like every other app here                           |
| npm workspaces                                   | `apps/*` already a workspace                                                                        | —                                                                   | ✅ `apps/dashboard-ng` joins automatically; Angular deps hoist to the root `node_modules` (the CLI handles that)                                                 |
| Karma                                            | 6.4.4                                                                                               | `@angular/build` 22 still lists `karma ^6.4` as a peer              | ⚠️ works, but **Karma is deprecated upstream** (last release Nov 2024) and Vitest is Angular's default runner since v21. Chosen on purpose for the learning goal |
| Jasmine                                          | `jasmine-core` 6.3.0, `@types/jasmine` 6.0.0 (what `ng new` pins for karma-jasmine 5.1; 7.x exists) | —                                                                   | ⚠️ root has `@types/jest` (global `describe`/`expect`) — clash avoided by `"types": ["jasmine"]` in `tsconfig.spec.json`                                         |
| ESLint                                           | root 10.5.0 + `typescript-eslint` 8.61                                                              | `angular-eslint` 22.6: `eslint ^9 \|\| ^10`, `typescript-eslint ^8` | ✅                                                                                                                                                               |
| Cypress                                          | 15.17.0 in `apps/marketplace`                                                                       | —                                                                   | ✅ reuse **15.17.0** (one Cypress binary for the repo) rather than the newer 16.x                                                                                |
| zone.js                                          | 0.16.3                                                                                              | Angular 22 apps are **zoneless by default**                         | ⚠️ `fakeAsync` needs zone.js — see below                                                                                                                         |

**How each conflict is solved**

1. **Node 22.22.2 → ≥ 22.22.3.** Locally: `nvm install 22 && nvm alias default 22` (also fixes the
   known Node-18 Husky issue). No change to CI. Optionally tighten root `engines` to
   `>=22.22.3` so the failure is explicit — asking before touching root config.
2. **Zoneless vs `fakeAsync`.** The app runs **zoneless** (`provideZonelessChangeDetection()`,
   default in v22) from Phase 1, so Phase 8's "zoneless if stable" is already satisfied. `zone.js`
   - `zone.js/testing` go into the **test polyfills only** (`angular.json` → `test.options.polyfills`)
     so `fakeAsync`/`tick` work in Karma without shipping zone.js to users.
3. **Jasmine vs Jest globals.** Separate `tsconfig.app.json` (no test types) and
   `tsconfig.spec.json` (`types: ["jasmine"]`); root `@types/jest` is never auto-included.
4. **Root `tsconfig.base.json` is NodeNext.** The app tsconfig extends it (keeps `strict`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, the `@ermulaku/types` path) but
   overrides `module: "ES2022"`, `moduleResolution: "bundler"`, adds `lib: DOM`, and turns on
   Angular's `strictTemplates`.
5. **Type-aware ESLint.** Root `eslint.config.mjs` gains one block scoped to
   `apps/dashboard-ng/**` with `angular-eslint` (TS rules + template rules); `no-explicit-any` stays
   an error. Angular's default solution-style `tsconfig.json` (only `references`) confuses
   typescript-eslint's `projectService`, so the app's `tsconfig.json` will be a real config that
   includes `src/**` (spec files included, jasmine types).

---

## 6. Risks

| #   | Risk                                                                                                                                                                                                      | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **RTK Query does a lot invisibly** (dedupe, tag refetch, cache reset on account switch). Missing one = stale data, e.g. the previous tutor's name after re-login (a real bug the React app already fixed) | `CacheTags` with the same tag names; meta-reducer reset; port `auth-cache-reset.test.ts` in Phase 7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | **GraphQL errors arrive as HTTP 200**, so an `HttpInterceptor` alone can't see "token expired" GraphQL errors                                                                                             | 401 handling in the interceptor; the `/token\|unauth/i` check in `GraphqlClient` (same regex as `api.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | **Auth calls must not carry a token** (React uses a separate raw `fetch`)                                                                                                                                 | `HttpContextToken` `SKIP_AUTH` set by `AuthApiService`; the interceptor honours it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 4   | **Socket transports**: must stay `['polling', 'websocket']` (App Runner 403s WS upgrades). React opens **two** connections (bookings in the shell, messages on /messages)                                 | Keep the exact options. Proposal: one shared connection in `LiveSocketService`, emitting both subscribe events — same events, one fewer socket (your call, see questions)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5   | **`API_URL` is inlined at build time** (Vercel env → `DefinePlugin`)                                                                                                                                      | `define` option driven by `process.env.API_URL` with the same `http://localhost:4000` default; verify the built JS contains the right URL                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | **Cutover on Vercel**: the existing project's _Root Directory_ is `apps/dashboard` (set in the Vercel UI, not in git) and Angular outputs to `dist/dashboard-ng/browser`, not `dist`                      | Phase 9: change Root Directory in the Vercel dashboard (manual, by you), new `vercel.json` in `apps/dashboard-ng` with the right `outputDirectory`, update the workflow `paths`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | **CORS**: production pins `CORS_ORIGINS`. Same domain after cutover → no change. A preview deployment on another domain would need the env var updated (config, not code)                                 | Don't deploy previews until Phase 9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8   | **Visual parity**: 2,335 lines of global CSS with shared class names                                                                                                                                      | Port as **global SCSS** with identical class names (component templates reuse them) instead of rewriting into encapsulated component styles. Less "pure Angular", but guarantees the same look; component-scoped styles only for new Angular-only bits                                                                                                                                                                                                                                                                                                                                          |
| 9   | **`npm audit` at 0**: Karma 6 pulls in older transitive deps                                                                                                                                              | **Phase 1 outcome:** the Angular deps introduced 4 findings. Fixed: Angular's pinned `vite` 8.3.0 → 8.3.5 (scoped override `"@angular/build": { "vite" }`) and the existing root `postcss` override 8.5.15 → 8.5.31 (also clears `beasties`). **Accepted:** `karma` → `chokidar@3` → `braces` (GHSA-vfj7-8cjw-p6xm, DoS on deeply nested glob patterns) — no patched `braces` exists (3.0.3 is the latest and affected); dev-only, patterns come from our own config. The ~60 other findings predate this branch (Next, Nx, NestJS, Prisma, Expo, Storybook) and are tracked for a separate fix |
| 10  | **Strict TS options in templates** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) can be noisy with `strictTemplates`                                                                         | Keep them (no loosening); type inputs precisely                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 11  | **Behaviour quirks to copy, not "fix"**: `/onboarding` isn't behind the auth check in React; the lessons list hard-codes "60 min"; the onboarding wizard pre-fills by setting state during render         | Keep visible behaviour identical; `/onboarding` gets `authGuard` (it already 401s → login in React, so the visible result is the same). Any real bug found goes on the parity list instead of being silently changed                                                                                                                                                                                                                                                                                                                                                                            |
| 12  | **Learning curve**: NgRx + RxJS + signals at once                                                                                                                                                         | One concept per phase, a short explanation + example after each                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## 7. Results (filled in during Phase 8)

| Metric                   | React (`apps/dashboard`) | Angular (`apps/dashboard-ng`) |
| ------------------------ | ------------------------ | ----------------------------- |
| Initial JS (gzip)        | _tbd_                    | _tbd_                         |
| Total JS (gzip)          | _tbd_                    | _tbd_                         |
| Lighthouse performance   | _tbd_                    | _tbd_                         |
| Lighthouse accessibility | _tbd_                    | _tbd_                         |

## 8. Parity checklist (filled in during Phase 8)

_tbd — one row per React screen and shell element._
