# @ermulaku/marketplace

The public TutorHub storefront — a **Next.js 16** App Router app (SSR + PWA) where
students discover tutors, view profiles with live availability, book lessons, manage their
schedule, save favourites, top up a wallet, and manage their account.

## Pages

| Route                  | What                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| `/[locale]`            | Landing: hero, subject categories, featured tutors, how-it-works, testimonials   |
| `/[locale]/tutors`     | Discover/search grid — free-text + level + max-price + min-rating + sort filters |
| `/[locale]/tutor/[id]` | Profile: headline, badges, languages, reviews, 3-step booking wizard, similar    |
| `/[locale]/lessons`    | Upcoming/past tabs with cancel, reschedule and review flows                      |
| `/[locale]/favourites` | Saved tutors (heart toggle on cards and profiles)                                |
| `/[locale]/wallet`     | Balance, gift-card redeem/buy, payment methods                                   |
| `/[locale]/account`    | Personal / security (password, 2FA) / notification-preference settings           |
| `/[locale]/login`      | Sign in / sign up (email + password)                                             |

## Highlights

- **SSR via GraphQL.** Pages are React Server Components that fetch from the API's Apollo
  GraphQL endpoint through a tiny typed `fetch` client (`src/lib/graphql.ts`, `src/lib/queries.ts`)
  — no client-side data library. Writes go through **Server Actions** (`src/lib/actions.ts`).
- **Real sessions.** Sign up / sign in mint a student JWT stored in an httpOnly cookie
  (`src/lib/session.ts`). There is **no guest/demo fallback** — signed-out visitors browse the
  public pages, and anything personal (lessons, wallet, booking, the assistant) requires a real
  session. Authenticated reads/writes carry the token server-side.
- **AI booking assistant.** A floating chat widget (`AssistantWidget`) on every page talks to the
  API's OpenAI-backed `/assistant/chat`; it can search tutors, check availability, and book — and
  offers **in-app links** to the results (e.g. "See maths tutors"). It's public, but sending a turn
  prompts sign-in, since it books on the caller's account.
- **Become a tutor.** A header CTA (and account-menu entry) links to the tutor dashboard app's
  `/signup`, configured via `TUTOR_APP_URL`.
- **Internationalised, RTL-ready.** A dependency-free i18n layer (`src/i18n`) with
  locale-prefixed routes (`/en`, `/ar`). Arabic renders fully mirrored via `dir="rtl"` and the
  CSS logical properties baked into `@ermulaku/ui`.
- **Shared UI.** Built from `@ermulaku/ui` primitives; GPU-only animations for sheets/modals.

## Develop

```bash
# API + DB must be up for the data pages (see repo HANDOFF.md):
npm run dev -w @ermulaku/marketplace      # http://localhost:3200 (→ /en)
npm run build -w @ermulaku/marketplace
```

Environment (`.env.local`; see `.env.example`): `API_URL` (default
`http://localhost:4000`) points the GraphQL client at the API, and `TUTOR_APP_URL`
(default `http://localhost:3100`) is where "Become a tutor" links. Both are read
server-side. In production these are set on the Vercel project — see
[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

## Structure

```
app/[locale]/            locale-scoped routes (root layout sets <html lang dir>)
  layout.tsx             header (with account menu) + UI tokens; pre-renders en + ar
  page.tsx               landing page
  tutors/ tutor/[id]/    discover grid + profile (booking wizard)
  lessons/ favourites/   schedule management + saved tutors
  wallet/ account/ login/ wallet, settings, auth
proxy.ts                 redirects locale-less paths, negotiates Accept-Language
src/i18n/                locales, dictionaries (en.json / ar.json), interpolate()
src/lib/graphql.ts       typed GraphQL-over-fetch client
src/lib/queries.ts       typed GraphQL operations (reads + mutations)
src/lib/actions.ts       Server Actions (auth, booking, favourites, wallet, account)
src/lib/session.ts       httpOnly-cookie JWT session (no guest fallback)
src/lib/env.ts           API_URL / TUTOR_APP_URL resolution
src/components/          Header, UserMenu, TutorCard, DiscoverFilters, BookingWizard,
                         FavoriteButton, LessonsView, WalletView, AccountView, AuthForm,
                         AssistantWidget (floating chat), AssistantNavTrigger
```

The AI assistant is a **global floating widget** mounted in `layout.tsx`, not a page.

## Deployment

Deployed to **Vercel** (SSR) by `.github/workflows/deploy-marketplace.yml`; the API runs
on AWS App Runner. See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).
