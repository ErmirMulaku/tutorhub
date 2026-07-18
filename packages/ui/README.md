# @ermulaku/ui

Shared, **RTL-safe**, **GPU-animated** React primitives for the TutorHub marketplace
(`apps/marketplace`). Documented in **Storybook**.

## Design constraints

- **RTL by construction.** Every directional style uses CSS _logical_ properties
  (`margin-inline`, `inset-inline-start`, `text-align: start`, …). The same stylesheet
  mirrors correctly under `dir="rtl"` with no per-component overrides.
- **GPU-only animation.** Transitions touch `transform` / `opacity` only and hint the
  compositor with `will-change`, so they never trigger layout or paint. `prefers-reduced-motion`
  disables them.
- **Dependency-free runtime.** No styling/util libraries — a `cx` joiner and a single
  token stylesheet. React is a peer dependency.
- **Theming via tokens.** Colours, spacing, radii, and motion are CSS custom properties on
  `:root`; `[data-theme='dark']` overrides them.

## Usage

```ts
import { Button, Card, StarRating, Price, Modal } from '@ermulaku/ui';
import '@ermulaku/ui/styles.css'; // once, at the app root
```

## Components

`Button` · `Card` · `Avatar` · `StarRating` · `Tag` · `Price` · `Skeleton` · `Modal`

## Scripts

```bash
npm run storybook -w @ermulaku/ui        # dev Storybook on :6006
npm run build-storybook -w @ermulaku/ui  # static Storybook → storybook-static
npm run build -w @ermulaku/ui            # tsc → dist + styles.css
npm test -w @ermulaku/ui                 # Jest + Testing Library
```

## Deployment

Storybook is deployed as a static site to its own **Vercel** project (Root Directory
`packages/ui`) by `.github/workflows/deploy-storybook.yml`. See
[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).
