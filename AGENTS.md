<!--
  Copy this into the repo root as AGENTS.md.
  This file is a GRADED artifact: it demonstrates the "AI-augmented workflow" requirement.
  Keep it living — update it as you build. Be specific and honest.
-->

# AI-Augmented Workflow

This project is built with an **AI-augmented engineering workflow**: AI agents (Claude Code,
Cursor, GitHub Copilot) handle the mechanical work so I can move faster, while I stay fully
accountable — as a senior engineer — for the architecture, correctness, and security of every
line that ships. AI is a **force multiplier for delivery**, not an unreviewed code source.

This file documents how I work with AI and, crucially, **how I verify what it produces.**

## Principles

1. **I own the output.** Anything an agent generates is my responsibility. If I can't explain it, it doesn't merge.
2. **Plan first, generate second.** I define the architecture, contracts, and acceptance criteria (see `SPEC.md`) before any agent writes code.
3. **Small, reviewable steps.** Agents work in tight, scoped tasks tied to a single phase/PR — never "build the whole app."
4. **Verification is non-negotiable.** Generated code passes typecheck, lint, and tests, and a manual review, before commit.
5. **Security stays human-owned.** Auth, validation, secrets, and data handling are reviewed by me regardless of who drafted them.

## How I use agents

- **Scaffolding & boilerplate** — project setup, config, repetitive CRUD, test skeletons.
- **Implementation from a spec** — I hand the agent the relevant `SPEC.md` section; it drafts; I review and refine.
- **Refactoring & tests** — generating edge-case tests (e.g. the slot-engine timezone cases), then I verify they actually assert the right behavior.
- **Docs** — first drafts of READMEs / API docs, which I correct for accuracy.

## Verification checklist (run before every commit)

- [ ] `npm run typecheck` passes (no `any` introduced)
- [ ] `npm run lint` passes
- [ ] `npm test` passes; new logic has tests I reviewed (not just generated)
- [ ] I read every changed line and can explain it
- [ ] No secrets, keys, or real card/PII data committed
- [ ] Input validated; authz checked on new endpoints/resolvers/RPCs
- [ ] Dependencies are necessary, reputable, and licence-compatible
- [ ] Behavior verified manually (ran it), not just "looks right"

## Security review for generated code

- Validate and type all external input (`class-validator` / GraphQL inputs / proto messages).
- Authn (JWT) + authz (roles) enforced server-side; never trust the client.
- Secrets only in env; `.env` is gitignored; `.env.example` documents required vars.
- The AI booking assistant: the model may _decide_ actions but **the server executes** them with
  the same auth/validation as any other request. The OpenAI key stays server-side.

## What I do NOT delegate

- Architecture and API contract decisions.
- Security-sensitive logic (auth, payments, data access boundaries).
- Final review and the decision to merge.

## Tooling

- **Claude Code** — multi-file implementation from spec, refactors, tests.
- **Cursor / Copilot** — inline completions and quick edits.
- Prompts used per phase are recorded in `SPEC.md` §17 for traceability.

## Commit & PR convention

- Commits follow Conventional Commits with a single imperative, capitalised subject ≤ 50 chars
  (enforced by commitlint); PRs note where AI assisted and what I changed/verified.
- Example PR line: _"Scaffolded resolvers with Claude from SPEC §9; rewrote the availability
  resolver to use slot-engine, added 6 timezone tests, verified DST boundaries manually."_

## Phase log

### Phase 1 — Foundation ✅

**Built (in small, reviewed commits):** an Nx + npm-workspaces monorepo with a strict shared
`tsconfig.base.json`; the ESLint (flat, `no-explicit-any: error`) / Prettier / Husky + lint-staged /
commitlint toolchain; `packages/types` (shared domain model, SPEC §8); and the flagship
`packages/slot-engine` — a zero-runtime-dependency, timezone/DST-aware `getAvailableSlots`
(buffer, lead time, breaks, overlaps, midnight crossing, injected deterministic `now`) built on the
runtime's `Intl` rather than a date library. A GitHub Actions workflow runs lint → typecheck → test
→ build on Node 22.

**Verified (not just generated):**

- `npx nx run-many -t lint typecheck test build` green across both packages; **42** slot-engine
  tests pass, including DST spring-forward (lost hour ⇒ fewer slots) and fall-back (gained hour ⇒
  more slots) with exact UTC-instant assertions I checked by hand against known CET/CEST offsets.
- Ran `npm ci` and the built ESM output as a smoke test to confirm real behaviour, not "looks right".
- **Security/deps:** `npm audit` driven to **0 vulnerabilities** by pinning patched transitive
  versions via `overrides` (`form-data`, `tmp`, and a scoped `js-yaml` for Jest's coverage tooling),
  each reviewed to confirm the override was API-compatible rather than a blind bump.

---

_This workflow is the point, not a footnote: ship faster with AI, and take senior accountability
for quality and security._
