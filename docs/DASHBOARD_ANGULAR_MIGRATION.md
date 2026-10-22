# Dashboard → Angular migration plan

Migrating the tutor dashboard (`apps/dashboard`: React 19 + Redux Toolkit + RTK Query + a
hand-written Webpack 5 build) to **Angular** as a new app at `apps/dashboard-ng`, **one feature at a
time**. The React app stayed live and untouched until the cutover (Phase 9); it has since been
removed from the branch — its last version is the tag `dashboard-react-final`, and the
`apps/dashboard/…` paths below refer to files at that tag.

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

**Implementation notes (Phase 7):**

- **zone.js only for `fakeAsync`, and a trap it set.** The `unit-test` builder (Karma runner) has
  no `polyfills` option of its own; it takes them from its build target. So the test target
  points at a `build:test` configuration whose polyfills are `["zone.js"]` (the builder adds
  `zone.js/testing`). The trap: once it sees zone.js, the builder's generated TestBed init also
  adds `provideZoneChangeDetection()`, quietly turning **every** test zone-based — the existing
  `App` spec broke at once (the theme effect never ran). `src/test-setup.ts` is listed first in
  `test.options.include` and registers a global `beforeEach` that provides
  `provideZonelessChangeDetection()`, so TestBed behaves like the zoneless app while `fakeAsync`
  keeps working. Angular's NG0914 warning ("zoneless, but Zone.js is loaded") confirms the
  combination; that one warning code is filtered, nothing else.
- **Ports of the React tests:** `ui-slice.test.ts` → `core/ui/ui.store.spec.ts` (+ persistence
  effects); `auth-cache-reset.test.ts` → `reset-on-auth-change.spec.ts` (a real store with the real
  meta-reducer); `OnboardingRoute.test.tsx` → `auth.guards.spec.ts` (incl. "decides nothing while
  loading" via an unanswered Subject); `WeekCalendar.test.tsx` (unrouted legacy) →
  `month-grid.spec.ts` on the real month view, including the October DST page.
- **What each Angular testing tool is used for:**

  | Tool                                    | Used in                                                                                                            |
  | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | Calling a functional effect with fakes  | `persistTheme(actions$, store)` — no TestBed module needed                                                         |
  | `TestScheduler` marble diagrams         | `loadRange` drops a stale week (`switchMap`); `changeStatus` keeps both (`mergeMap`); errors don't kill the effect |
  | `provideMockStore` + `overrideSelector` | guards, interceptor, notifications bell                                                                            |
  | `HttpTestingController`                 | interceptor headers / 401, GraphQL unwrapping and auth-error sign-out, one API service's document + tags           |
  | `fakeAsync` + `tick`                    | toast auto-dismiss (2.5 s), modal rAF-in / 200 ms-out, scroll lock, focus return                                   |
  | `jasmine.createSpyObj` + `useValue`     | APIs and the toast service in component specs                                                                      |
  | `InjectionToken` fake                   | `LIVE_SOCKET_FACTORY` → a `FakeSocket` that can fire `connect` / events                                            |

- **Zoneless testing gotcha (worth knowing):** a loading resource is a _pending task_, so
  `fixture.whenStable()` waits for its data — with a fake request that never answers, it hangs.
  While a request is open, `TestBed.tick()` runs change detection instead.
- **Tests that test the tests.** Eight deliberate bugs were planted one at a time by a script
  (`switchMap` → `mergeMap` in `loadRange`, no sign-out on 401, GraphQL auth errors ignored, the
  meta-reducer dropping `ui`, `loadOnTags` never unsubscribing, dollars sent instead of cents, the
  socket left open, the onboarding guard failing closed); each made exactly the intended spec fail.
  One didn't at first: the "theme survives sign-out" spec passed with `ui` wiped, because the
  default theme follows the OS and this machine is in dark mode — it now asserts the accent, which
  has a fixed default.
- **Small fix found by a spec:** `BarChart` wrote `height: NaN%` for a non-finite value (as React
  did); non-finite values now size as 0.
- **Cypress with fixtures, no backend.** One `cy.intercept('POST', …/graphql)` reads each
  operation's root field, aliases the request by it and replies from `cypress/fixtures/graphql.json`
  or a per-test override (a function for stateful flows — accept → the next `tutorBookings` shows
  it confirmed). An operation **without** a fixture fails the test in `afterEach`; proven by
  deleting `topSubjects`: the Analytics card had silently rendered empty, and the guard caught it.
  Socket.IO's handshake is refused with a 503. 10 tests: sign-in (no token on the sign-in call,
  Bearer after), wrong password, a GraphQL auth error signing out, theme surviving sign-out,
  accept → toast → refetch → both badges, live topbar search, the promotion form (blocked, then
  1250 cents sent, grid refetched), and a smoke test opening all 11 screens from the sidebar.
- **CI:** Karma runs inside the existing `verify` job (`nx run-many -t test`) with
  `KARMA_BROWSER=ChromeHeadlessNoSandbox` (Angular's built-in launcher; the runner's kernel may
  refuse Chrome's sandbox). A new `dashboard-ng-e2e` job needs no Postgres or API: `npm ci`, then
  `cypress-io/github-action` starts the dev server and runs the specs; failure screenshots are
  uploaded as an artifact.

**Implementation notes (Phase 8):**

- **Already in place:** all 44 components are `OnPush`; templates use only the built-in control
  flow (`@if` / `@for` / `@switch` — no `*ngIf`, `*ngFor` or `CommonModule`), and every `@for` has
  a `track` (three track by index, each over a fixed list that never reorders). The app has been
  zoneless since Phase 1.
- **Redux DevTools out of production (−4.8 kB gzip initial).** The esbuild metafile
  (`ng build --stats-json`) showed `@ngrx/store-devtools` — 15.3 kB raw — in the initial bundle:
  `logOnly: !isDevMode()` is a _runtime_ switch, so the code always ships. Devtools are now
  provided from `environments/dev-tools.ts` (no providers) which the `development` configuration
  swaps for `dev-tools.development.ts` (`fileReplacements`). Verified: the production bundle has
  no `__REDUX_DEVTOOLS_EXTENSION__`, the development build does.
- **`@defer` for the charts: measured, then reverted.** Wrapping both charts in
  `@defer (on viewport; prefetch on idle)` did split them out (AreaChart 1.9 kB, BarChart 1.3 kB
  raw) — but the deferrable-views runtime (IntersectionObserver / idle triggers, dependency
  loading) landed in Angular's core chunk, which **every** page loads: initial JS went 102.3 →
  106.2 kB gzip to save 1.4 kB of code that was already lazy with its route. A plain `@defer` still
  cost +3.3 kB. `@defer` pays off for heavy, rarely shown blocks inside an eagerly loaded view; here
  every route is already lazy and the deferrable candidates are tiny. (The heaviest post-login code
  is socket.io — a service, not a template block — see gap 3.)
- **Budgets that fail the build** (`angular.json`, production): initial 380 / 420 kB, all scripts
  600 / 700 kB, the post-login `shell-routes` chunk 85 / 100 kB, component styles 2 / 4 kB (warning
  / error, raw bytes). Proven by tightening them: the build printed the overrun and exited 1.

**Phase 8 follow-up — the two shared gaps, fixed in the Angular app:**

- **The layout shift was mostly the setup banner, not the skeletons** (correcting the first
  Phase 8 gap list, which blamed the skeletons alone). Lighthouse names the elements that _moved_, so the trace's raw `LayoutShift`
  rects were read: the KPI row and the greeting both moved **up** 155 px — something above them
  vanished. `published` started as `false` while unknown (as in React), so a published tutor saw
  "Finish setting up" flash and disappear. It is now `boolean | null` and the banner needs
  `=== false`. The skeletons _were_ also wrong (120 px vs 153 px cards), and `line-height: normal`
  made the card grow when the web font replaced the fallback; the card's two line boxes are now
  fixed at the values the font already produced, and the skeletons use an exported
  `KPI_CARD_HEIGHT`, guarded by a spec that renders a real card under the global CSS in Karma's
  fallback font.
- **Reproducing it needed a slow API.** Locally the API often answers before the first paint, so
  CLS swung between 0 and 0.19 run to run. The measurement server can now hold every API call
  800 ms (a realistic network to the API) — React then shifts 0.188 on every run, Angular 0.003.
- **Contrast — fixed at the token level, wider than the two flagged elements.** Every earlier run
  was in **dark** mode (the machine's OS theme). `--faint` (sidebar labels, eyebrows, calendar
  hours, chart axes, table headers) was 2.2:1 in light and 3.9:1 in dark; it is now 5.0 / 5.2:1 on
  its real backgrounds. The white buttons on the brand gradient (Up next, Earnings balance, setup
  banner, onboarding step dots) used `--primary-700`, which the dark ramp flips to a light shade
  (1.9:1); a theme-independent `--on-white-primary` per accent fixes all four (5.6–7.4:1). The same
  rule pair also caused the "Withdraw now" label to vanish on hover (the primitive's hover is more
  specific and painted the text colour behind it) — fixed too. All deviations live in
  `styles/_overrides.scss`; `_app.scss` stays verbatim.
- **Caught on the way:** `MockStore.overrideSelector` patches the shared memoized selector, so the
  new dashboard spec's override leaked into a later real-store spec; every spec that overrides now
  calls `store.resetSelectors()` (the NgRx-documented teardown).

**Implementation notes (Phase 9 — cutover, prepared on the branch):**

- **The branch could not have deployed as it was.** Preparing the cutover meant testing the
  install the way CI, the API image and Vercel run it — on Linux — and it failed everywhere:
  `@angular-devkit/core` has an optional peer `chokidar@^5`, but the lockfile (written on macOS)
  hoisted `chokidar@4.0.3` (pinned by `@nestjs/graphql`). macOS `npm ci` passed; Linux `npm ci`
  refused the lockfile. Re-resolved on Linux: chokidar/readdirp 5 at the root, 4 nested under
  `@nestjs/graphql`, nothing else changed version. `npm ci --dry-run` reproduces the failure
  cheaply (it validates the lockfile without installing), which made it the regression check.
- **The API image never knew about `dashboard-ng`:** `npm ci` needs every workspace manifest, and
  `services/api/Dockerfile` did not copy the new one (fixed before the removal, then the React line
  removed).
- **Nx could deploy a stale `API_URL`.** The build inlines it, but the cache key only covered
  files — `API_URL=A` then `API_URL=B` replayed A's bundle. `API_URL` is now a build input.
- **Deploy config:** `apps/dashboard-ng/vercel.json` mirrors the React one (install/build from the
  repo root) with Angular's output directory, `CYPRESS_INSTALL_BINARY=0` (no 200 MB binary in the
  Vercel install), immutable caching only for hashed files, `node -v` in the log, and a build that
  **fails when `API_URL` is unset** instead of shipping `localhost`. The whole install + build was
  run from that file inside a Linux container: green on Node 22.23.4, and refused on Node 22.22.1
  (Angular 22 needs ≥ 22.22.3). Vercel exposes only the major version ("latest 22.x"), so the
  runbook below has a preview-build step that proves the exact patch before production.
- **Removing `apps/dashboard` flushed out a phantom dependency:** `packages/ui`'s tests used
  `@testing-library/dom` (a peer of `@testing-library/react`) that only the React app declared;
  it is now declared in `packages/ui`. Nothing else imported the removed packages. The
  `http-proxy-middleware` override (React dev server only) went too; `uuid`'s stays (`@lhci/cli`).
- **The dashboard keeps port 3100 locally**, which the marketplace's "Become a tutor" link and
  the API's Connect return URL already default to — so neither needed a change.
- **Tag `dashboard-react-final`** = `master` at the cutover (`4460d72`), i.e. exactly what
  production served. Local only until pushed.

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
| 9     | Cutover: tag `dashboard-react-final`, point the deploy at `dashboard-ng`, remove `apps/dashboard` in its own commit, docs, CV bullets + interview Q&A — **done on the branch**; going live is the runbook in §9       | Production serves the Angular app                                               |

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

## 7. Results (measured in Phase 8, 2026-10-21)

Both production builds, served the same way (gzip, immutable caching for hashed assets, SPA
fallback — like Vercel) from a local static server. Bundle sizes are gzip -9 of the built files;
"initial" is what `index.html` loads. Lighthouse 12.6.1, **median of 3 runs**; the signed-in
dashboard talks to the real local API (seed tutor) — the session is put in `localStorage` by the
test server, because Lighthouse clears storage.

| Metric                                         | React (`apps/dashboard`)  | Angular (`apps/dashboard-ng`) |
| ---------------------------------------------- | ------------------------- | ----------------------------- |
| Initial JS (gzip)                              | 131.4 kB (3 files)        | **97.5 kB** (4 files)         |
| Total JS (gzip)                                | **131.4 kB** (one bundle) | 184.3 kB (36 lazy chunks)     |
| Initial CSS (gzip)                             | 11.3 kB                   | 8.5 kB                        |
| JS transferred on `/login`                     | 132 kB                    | **115 kB**                    |
| JS transferred on `/dashboard` (signed in)     | 132 kB                    | 132 kB                        |
| Lighthouse performance — `/login`, desktop     | 100                       | 100                           |
| Lighthouse performance — `/dashboard`, desktop | 98                        | 99                            |
| Lighthouse performance — `/dashboard`, mobile  | 83                        | 85                            |
| FCP / LCP — `/dashboard`, mobile               | 2.41 s / 3.22 s           | 2.01 s / 2.86 s               |
| TBT / CLS — `/dashboard`, mobile               | 6 ms / 0.188              | 22 ms / 0.180                 |
| Lighthouse accessibility (login / dashboard)   | 91 / 91 (95 mobile)       | 94 / 91 (95 mobile)           |
| Lighthouse best practices                      | 100                       | 100                           |

**After the Phase 8 follow-up fixes** (same machine and method; Angular rebuilt, React unchanged —
React still has the gaps Angular had before; Angular's Phase 8 run had CLS 0.180 mobile):

| Lighthouse (median of 3)                         | React           | Angular        |
| ------------------------------------------------ | --------------- | -------------- |
| `/dashboard` mobile — performance / CLS          | 86 / 0.188      | **93 / 0.003** |
| `/dashboard` mobile, API +800 ms — perf / CLS    | 80 / 0.188 (×3) | **91 / 0.003** |
| `/dashboard` desktop — performance / CLS         | 96 / 0.051      | **99 / 0.004** |
| Accessibility, dark — login / dashboard mobile   | 91 / 95         | **100 / 100**  |
| Accessibility, light — login / dashboard desktop | 91 / 91         | 94 / 91        |

The light-theme accessibility runs are new: they surfaced the brand-colour findings in the gap
list below, which the earlier (dark) runs could not see.

**Reading it honestly:** Angular ships **26 % less JavaScript up front** because every route is
lazy, and paints first a bit sooner (FCP −0.4 s on throttled mobile). But its **total** JavaScript
is **40 % larger**: Angular core + router + RxJS + NgRx + Forms outweigh React + Redux Toolkit. A
signed-in visit to the dashboard downloads the same 132 kB in both, so it's a wash there; the win
is on the login page and on every screen the tutor never opens. Before the follow-up, mobile scores
sat at 83–85 for both because of the same layout shift, not JavaScript; with it fixed, Angular's
mobile dashboard scores 93.

## 8. Parity checklist (Phase 8)

✅ same behaviour · ✅+ same, plus a documented improvement · ⚠️ a deliberate difference.

| React screen / shell element                        | Angular                                          | Status                                                                                |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Login (+ unverified → verify code)                  | `LoginPage`, `VerifyPanel`                       | ✅                                                                                    |
| Sign-up → verify → onboarding                       | `SignupPage`, `VerifyPanel`                      | ✅                                                                                    |
| Session: 401 / GraphQL auth error → `/login`        | interceptor + `GraphqlClient` + sign-out effect  | ✅                                                                                    |
| Account switch drops the previous tutor's cache     | `resetOnAuthChange` meta-reducer                 | ✅                                                                                    |
| `/onboarding` route                                 | behind `authGuard` + `onboardingGuard`           | ⚠️ signed-out visitors go to `/login` first (React let them in, then 401'd)           |
| Onboarding wizard (6 steps, publish)                | `OnboardingPage`                                 | ✅+ toasts now show (React's provider sat inside the shell)                           |
| Sidebar (groups, badges, profile link, sign-out)    | `aside[th-sidebar]`                              | ✅                                                                                    |
| Mobile drawer (< 1024 px)                           | shell + `ui.sidebarOpen`                         | ✅                                                                                    |
| Topbar (titles, online pill, accent, theme)         | `header[th-topbar]`                              | ✅                                                                                    |
| Topbar search → `/lessons?q=`                       | same                                             | ✅+ live (debounced) while on /lessons                                                |
| Notifications bell                                  | `NotificationsBell` (NgRx `dashboard`)           | ✅                                                                                    |
| New-lesson modal                                    | `NewLessonModal` (NgRx `bookings`)               | ✅                                                                                    |
| Toasts                                              | `ToastService` + root `ToastHost`                | ✅+ shown outside the shell too                                                       |
| Theme / accent persisted (same keys)                | `ui` effects                                     | ✅                                                                                    |
| Live bookings socket (shell) + messages socket      | `LiveSocketService`, two connections as in React | ✅                                                                                    |
| Dashboard (KPIs, today, up next, review, banner)    | `DashboardPage`                                  | ✅+ failed loads show Retry; no banner flash or KPI jump while loading                |
| Calendar Day / Week / Month                         | `CalendarPage`, `MonthGrid`                      | ✅+ DST-safe (React showed 25 Oct twice)                                              |
| Lessons tabs, accept / decline / complete           | `LessonsPage` (entity adapter)                   | ✅+ failed updates toast (React silent)                                               |
| Messages (threads, chat, composer, live)            | `MessagesPage`                                   | ✅+ failed send restores the draft                                                    |
| Catalog + new service                               | `CatalogPage`, `NewServiceModal`                 | ✅+ inline validation                                                                 |
| Availability (hours, rules, time off)               | `AvailabilityPage`, `WeeklyHoursEditor`          | ✅+ inline validation; time off works (API fix `8136a7f` helps React too)             |
| Earnings (balance, chart, payout, CSV)              | `EarningsPage`                                   | ✅+ CSV quotes fields / defuses formulas; withdraw errors shown; hover label readable |
| Marketing (stats, promotions, gift cards, referral) | `MarketingPage`, `NewPromotionModal`             | ✅+ validation, typed amount kept, honest "Copied"                                    |
| Reviews (summary, filters, replies)                 | `ReviewsPage`, `ReviewCard`                      | ✅+ Enter sends, failures toast                                                       |
| Analytics (KPIs + four charts)                      | `AnalyticsPage`, `AreaChart`, `BarChart`         | ✅                                                                                    |
| Settings (profile, payout, notifications, delete)   | `SettingsPage`, `DeleteAccountCard`              | ✅+ timezone validation, optimistic toggles roll back                                 |
| Unknown URL → `/dashboard`                          | `**` redirect                                    | ✅                                                                                    |
| Redux DevTools                                      | development builds only                          | ⚠️ React exposes the store to the extension in production too                         |
| Data caching                                        | `cachedQuery` + `CacheTags`                      | ⚠️ a screen refetches on every visit (RTK served a fresh cache)                       |
| 5 unrouted legacy components                        | not ported                                       | ⚠️ dead code, no visible behaviour                                                    |

**Gaps and follow-ups (not done in this migration):**

1. ~~Layout shift on the dashboard~~ — **fixed** (follow-up above): CLS 0.18 → 0.003 on mobile.
2. ~~Colour contrast of `--faint` and the white gradient buttons~~ — **fixed**: dark-theme
   accessibility 100 on login and the mobile dashboard.
3. **socket.io (~49 kB raw) ships in the shell chunk**, i.e. on the path to the first signed-in
   screen. It could be loaded with a dynamic `import()` once the shell is shown.
4. **Kept React quirks:** `money()` rounds to whole dollars ($12.50 promotion → "$13 off") and the
   lessons list always says "60 min". (The "Withdraw now" hover label is fixed.)
5. **Light-theme contrast, both apps — a design decision, not a bug fix:** the brand **teal**
   `#0e8f8a` is 3.95:1 against white, both as the primary button background (white text) and as
   link text ("Open calendar →", "Create an account", avatars); AA for small text needs 4.5. Indigo
   and plum already pass. The success green on its tint (`#1fa463` on `#e2f5ea`, the "Online" and
   "Confirmed" pills) is 2.82:1. Fixing either means darkening a brand colour.
6. **Touch targets, both apps:** the three accent swatches are 16 × 16 px; WCAG 2.2 asks for a
   24 px target (the dots can stay 16 px with a larger hit area).
7. **CI has not run on GitHub yet** (nothing pushed); the Karma + Cypress jobs were only validated
   locally.
8. Outside this migration: ~60 pre-existing `npm audit` findings, the 6 pre-existing API e2e
   failures (10.5b), and Karma's deprecation (Vitest is Angular's default runner).

## 9. Cutover runbook (Phase 9)

Everything in git is done on `feat/dashboard-angular-migration`. Going live needs these steps, in
this order — the Vercel ones are project settings that only you can change.

**What merging deploys.** The lockfile and root `package.json` changed, so the merge triggers
**all four** deploy workflows: dashboard (Angular now), **API** (App Runner — it also ships the
`addTimeOff` validation fix from 10.5b; no migrations on this branch), marketplace and Storybook
(lockfile only, no code change).

1. **Push and open the PR.** `git push -u origin feat/dashboard-angular-migration` and
   `git push origin dashboard-react-final`. This is the branch's **first CI run** — `verify`
   (incl. Karma), `marketplace-e2e`, `dashboard-ng-e2e` and `notifications` must be green.
2. **Vercel → the dashboard project → Settings → Build and Deployment:**
   - **Root Directory:** `apps/dashboard-ng` (was `apps/dashboard`). Keep "Include files outside
     the root directory" on — install and build `cd ../..`.
   - **Node.js Version:** 22.x. (If step 3 shows a version below 22.22.3, switch to 24.x.)
   - **Environment Variables:** `API_URL` must exist for Production _and_ Preview — the build
     now fails without it.
     Changing settings does not deploy anything; production keeps serving React.
3. **Preview build (no production impact):** from the repo root, with the same env as the
   workflow, `VERCEL_ORG_ID=… VERCEL_PROJECT_ID=… npx vercel deploy` (no `--prod`). In the build
   log check `v22.…` (≥ 22.22.3) and "Application bundle generation complete". Opening the
   preview shows the login page; its API calls may hit CORS (a preview origin isn't in
   `CORS_ORIGINS`) — that's expected, this step only proves the build.
4. **Merge the PR** (you merge — Claude never does). Watch **Deploy Dashboard** and **Deploy API**.
5. **Smoke test production:** sign in; the dashboard shows the tutor's KPIs and today's lessons;
   accept or open a lesson; a second tab sees a live change; Calendar / Messages / Earnings open.
   No CORS change is needed — same domain.

**Rollback**

- **Fast (no rebuild):** Vercel → Deployments → the last React production deployment →
  **Instant Rollback**. Then set Root Directory back to `apps/dashboard` before anything else
  deploys, or the next merge ships Angular again.
- **Full:** set Root Directory to `apps/dashboard`, then GitHub → Actions → **Deploy Dashboard** →
  Run workflow → ref **`dashboard-react-final`**.

CV bullets and interview Q&A drawn from this migration: [`DASHBOARD_ANGULAR_INTERVIEW.md`](./DASHBOARD_ANGULAR_INTERVIEW.md).
