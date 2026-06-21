# @ermulaku/marketplace

The public TutorHub storefront — a **Next.js 16** App Router app (SSR + PWA) where
students discover tutors, view profiles with live availability, and book lessons.

## Highlights

- **SSR via GraphQL.** Pages are React Server Components that fetch from the API's Apollo
  GraphQL endpoint (`tutors` / `tutor` / `availability`) through a tiny typed `fetch` client
  (`src/lib/graphql.ts`) — no client-side data library.
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

`API_URL` (default `http://localhost:4000`) points the GraphQL client at the API.

## Structure

```
app/[locale]/            locale-scoped routes (root layout sets <html lang dir>)
  layout.tsx             header + UI tokens; pre-renders en + ar
  page.tsx               landing page
proxy.ts                 redirects locale-less paths, negotiates Accept-Language
src/i18n/                locales, dictionaries (en.json / ar.json), interpolate()
src/lib/graphql.ts       typed GraphQL-over-fetch client
src/components/          Header, LocaleSwitcher
```
