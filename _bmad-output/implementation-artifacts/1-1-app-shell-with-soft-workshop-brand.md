---
baseline_commit: NO_VCS
---

# Story 1.1: App shell with Soft Workshop brand

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want a Next.js app with Soft Workshop / Lavender Workshop styling and a Russian planning shell that lands on Create Menu after I am signed in,
So that I have a real workspace to build Menus in, not an empty dashboard.

## Acceptance Criteria

1. **Given** a greenfield repo  
   **When** the project is initialized from `create-next-app -e with-supabase`, upgraded to Tailwind 4.x, and laid out per Architecture Structural Seed (`app/`, `src/lib/supabase/`, `supabase/`)  
   **Then** the app runs locally against Supabase Auth/DB clients  
   **And** Lavender Workshop tokens from DESIGN.md are applied (background, surface, primary `#4338CA`, accent, border, warning-*, empty-slot, radii sm/md/lg)  
   **And** Geist Sans is used; light mode only; UI copy is Russian  
   **And** authenticated home shows Create Menu / planning landing with pill-nav placeholders (Дни · Меню · План порций · Shopping list) — not an empty dashboard (FR25, UX-DR1–4)

2. **Given** an unauthenticated visitor  
   **When** they open a planning route  
   **Then** they are redirected toward sign-in (full auth completes in Story 1.2 if only stubbed here)

## Tasks / Subtasks

- [x] Bootstrap Next + Supabase scaffold (AC: #1)
  - [x] Run `npx create-next-app -e with-supabase` into this repo (or temp dir then merge) — greenfield; no existing `package.json`
  - [x] Require **Node.js ≥22**; pin stack versions from Architecture Spine (see Dev Notes)
  - [x] Upgrade Tailwind to **4.3.3** (CSS-first `@theme`); remove starter Tailwind 3 / `tailwindcss-animate` if present; use `tw-animate-css` if shadcn needs animate
  - [x] Align folders to Structural Seed: `app/`, `src/lib/supabase/`, `src/domain/` (placeholder), `supabase/`; move starter `lib/supabase/*` → `src/lib/supabase/`
  - [x] Init shadcn/ui for Tailwind v4 (new-york style, RSC); do not replace with another UI kit
  - [x] Wire `.env.example` / `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key still works as value during migration)
  - [x] Confirm `npm run dev` starts and Supabase clients construct without crash

- [x] Apply Soft Workshop / Lavender Workshop brand layer (AC: #1)
  - [x] Map DESIGN.md frontmatter colors → CSS variables on shadcn/Tailwind (include full UX-DR1 set: foreground, muted, warning-*, empty-slot, slot-label, snacks-border — not only AC shortlist)
  - [x] Apply Soft Workshop radii: sm 10 / md 12 / lg 14 / xl 16 / full 9999
  - [x] Geist Sans via `next/font`; **light mode only** — no `next-themes` / dark tokens
  - [x] All user-visible UI strings in **Russian**; English glossary ids only in code

- [x] Build authenticated app shell + Create Menu landing (AC: #1)
  - [x] `AppShell` layout: header (surface + border), content on background, max-width ~1180px, page gutter 28–40px
  - [x] Header left: wordmark `Keplo` (accent, section-title) + muted store-context subtitle placeholder (e.g. «Магазин · д. Алабино, 92»)
  - [x] `pill-nav` placeholders: Дни · Меню · План порций · Shopping list (aria-label «Шаги планирования»); «Дни» active on landing
  - [x] Primary nav links: Create/planning (home), История, Настройки (Settings content stub — store-picker is Story 1.3)
  - [x] Authenticated home = Create Menu / planning landing with page-title + stub workspace content — **not** empty dashboard
  - [x] Optional empty `warning-stale` slot under header (visual chrome only; behavior Story 1.5) — if present, copy must follow EXPERIENCE.md, not mock fallback wording
  - [x] Omit mock presentation chrome (browser frame, traffic lights, fake URL bar)

- [x] Auth redirect stub for planning routes (AC: #2)
  - [x] Keep `@supabase/ssr` clients + root middleware calling `getUser()`
  - [x] Unauthenticated access to planning / History / Settings → redirect toward `/auth/login` (or starter sign-in route)
  - [x] Do **not** implement full email/password UX, RLS policies, or hardened session tests — Story 1.2 owns that
  - [x] Stub login page in Russian is OK; post-sign-in target must be Create Menu landing when session exists

- [x] Smoke verification (AC: #1, #2)
  - [x] Manual: tokens visible, RU copy, pill-nav + primary nav render, landing is Create Menu
  - [x] Manual: unauthenticated hit on a planning route redirects to sign-in
  - [x] Keyboard: tab through header controls; focus rings visible on background

### Review Findings

- [x] [Review][Patch] Include Geist `cyrillic` subset so Russian UI does not fall back to system fonts [app/layout.tsx:14]
- [x] [Review][Patch] Replace English email placeholder with Russian workshop copy [src/components/login-form.tsx:90]
- [x] [Review][Patch] Remove double focus rings (global CSS + component `focus-visible`) [app/globals.css:70]

## Dev Notes

### Epic context

Epic 1 — Sign in, workspace & store catalog: operator signs in, lands on Soft Workshop shell, picks store in Settings, plans against fresh catalog. Story 1.1 is the **greenfield foundation**; 1.2–1.5 add auth, store picker, sync worker, stale block.

Sibling stories (do not implement here):
- **1.2** — Login/password, RLS, full route protection
- **1.3** — Store picker in Settings
- **1.4** — Python `sync/` catalog worker
- **1.5** — `warning-stale` blocks Menu planning

### Technical requirements (MUST follow)

| Item | Requirement |
| --- | --- |
| Starter | `create-next-app -e with-supabase` then post-scaffold alignment |
| Node | ≥22.0.0 |
| Next.js | 16.2.10 (App Router) |
| React | 19.2.7 |
| TypeScript | 5.x (pin `^5` — do not pull TS 7 via `latest`) |
| Tailwind | 4.3.3 CSS-first |
| shadcn/ui | Current CLI, Tailwind v4 path |
| @supabase/supabase-js | 2.110.7 |
| @supabase/ssr | 0.12.3 |
| Deploy target | Dokploy for Next (not Vercel-as-SoT); local `npm run dev` is AC success for 1.1 |
| Dependency direction (AD-6) | `UI → domain → supabase clients`; **no** UI↔sync imports; `supabase/migrations` = schema SoT |
| Auth pattern (AD-5 stub) | Cookie sessions via `@supabase/ssr`; middleware `getUser()`; no NextAuth/Clerk/anonymous |

### Architecture compliance

- **Structural Seed paths** (create even if empty): `app/`, `src/domain/`, `src/lib/supabase/`, `supabase/`. `sync/` may wait until Story 1.4.
- **IA:** post-sign-in → Create Menu / planning; History + Settings in primary nav; pill-nav is **flow wayfinding only**, not a sidebar/global mega-nav.
- **Naming:** English domain ids in code; Russian UI only; kebab-case routes; PascalCase components.
- **Config:** only public Supabase URL + publishable/anon in browser. No service role or OpenRouter keys in client.
- **Non-goals in code:** in-app cart edit, stock badges, dark mode, mobile-first layout, Pantry, Recipe library, match-review, cook timers.

[Source: `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md` — Stack, Structural Seed, AD-1, AD-5, AD-6, Consistency Conventions]

### UX / brand compliance

Apply brand **delta** on shadcn — do not rebuild a parallel design system.

**Colors (required):**

| Token | Hex |
| --- | --- |
| background | `#EEF2FF` |
| surface | `#FFFFFF` |
| foreground | `#1E293B` |
| muted / muted-foreground | `#64748B` |
| primary | `#4338CA` |
| primary-foreground | `#FFFFFF` |
| accent | `#312E81` |
| border | `#E0E7FF` |
| warning-bg / fg / border | `#FEF9C3` / `#854D0E` / `#FDE047` |
| empty-slot | `#F8FAFC` |
| slot-label | `#94A3B8` |
| snacks-border | `#C7D2FE` |

**pill-nav:** track = background; active pill = surface + primary text + shadow `0 1px 2px rgba(67, 56, 202, 0.15)`; inactive = muted; radius full.

**Voice:** home-workshop, practical Russian — no marketing hero, streaks, emoji hype. EXPERIENCE.md wins over mockups on copy conflicts.

**Visual refs (intent only):**  
`_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/mockups/mock-create-menu.html`, `direction-b-soft-workshop.html` — adapt to React/shadcn; strip `.browser` chrome.

[Source: `DESIGN.md` frontmatter + Brand/Layout/Components; `EXPERIENCE.md` Foundation, IA, Voice; epics UX-DR1–4]

### File structure requirements

Suggested NEW files (names may vary; keep Structural Seed):

```text
app/
  layout.tsx                          # Geist, lang="ru", theme tokens
  globals.css                         # Tailwind 4 + Lavender CSS vars
  (authenticated)/
    layout.tsx                        # AppShell wrapper
    page.tsx                          # Create Menu landing
    history/page.tsx                  # Stub
    settings/page.tsx                 # Stub
    plan/menu/page.tsx                # Optional stub for pill «Меню»
    plan/portions/page.tsx            # Optional stub
    plan/shopping-list/page.tsx       # Optional stub
  auth/login/page.tsx                 # Sign-in stub (1.2 completes)
src/
  components/layout/app-shell.tsx
  components/layout/app-header.tsx
  components/layout/pill-nav.tsx
  components/layout/primary-nav.tsx
  lib/supabase/client.ts
  lib/supabase/server.ts
  lib/supabase/middleware.ts
  domain/.gitkeep                     # Placeholder for AD-6
middleware.ts                         # Session refresh + redirect stub
supabase/                             # Keep from starter / CLI
```

**UPDATE after starter:** move clients to `src/lib/supabase/`; pin package versions; Tailwind 4 globals; remove dark-mode scaffolding if starter adds it.

### Library / framework requirements

- **Use:** Next App Router, React 19, Tailwind 4, shadcn/ui, Geist Sans, `@supabase/ssr` + `@supabase/supabase-js` at pinned versions.
- **Do not use:** MUI/Chakra/other kits; NextAuth/Clerk; CSS-in-JS theme systems; `next-themes` dark mode; community alternate starters that assume Vercel+dark as SoT.
- **Animate:** prefer `tw-animate-css` with Tailwind 4 / modern shadcn — not legacy `tailwindcss-animate`.

### Latest tech notes (scaffold reality)

- Official command remains `npx create-next-app -e with-supabase` ([Supabase Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)).
- Starter may ship Tailwind 3 and flat `lib/supabase/` — Architecture **requires** post-scaffold upgrade to Tailwind 4.3.3 and `src/lib/supabase/`.
- Env naming: prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; dashboard may still show anon key — same value works during transition.
- Pin `@supabase/*` to Spine versions; do not leave `"latest"`.

### Testing requirements

No test framework mandated by Architecture for 1.1. Minimum:

1. Manual smoke: shell renders with tokens + RU copy + pill/primary nav
2. Manual: unauthenticated planning route → sign-in redirect
3. Manual a11y: keyboard reachability + focus rings (NFR4 floor)

Do not block 1.1 on Playwright/Vitest setup unless already added by starter.

### Project context reference

No `project-context.md` in repo yet. Follow Architecture Spine + DESIGN.md + EXPERIENCE.md. Domain glossary English ids: see `_bmad-output/specs/spec-keplo/glossary.md` when touching domain names.

### Previous story intelligence

N/A — first story in Epic 1; greenfield repo (planning artifacts only under `_bmad*`, `docs/`).

### Anti-patterns (prevent disasters)

- Empty dashboard after “sign-in”
- Implementing full auth/RLS/store picker/sync/stale-block “while here”
- Sidebar IA instead of header pill track
- Dark mode or second CTA chroma / purple SaaS drift
- Putting Supabase clients outside `src/lib/supabase/`
- Shipping mock browser chrome
- Inventing Pantry / Recipe library / mobile breakpoints
- Blocking Settings when catalog is later marked stale (Settings must remain reachable — FR-18 / CAP-15; ensure nav link exists)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1, UX-DR1–4, NFR1–3/10, FR25]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-keplo-2026-07-19/ARCHITECTURE-SPINE.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-keplo-2026-07-19/prd.md` — FR-23 auth boundary, FR-18 Settings remain]
- [Source: `_bmad-output/specs/spec-keplo/SPEC.md` — Constraints, Soft Workshop visual contract]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Starter ships Next 16 `proxy.ts` (middleware rename) + Tailwind 3; post-scaffold upgrade applied.
- Auth redirect verified via curl 307 → `/auth/login` with `KEPLO_DEV_BYPASS_AUTH=false`.
- Focus ring verified: indigo ring on `#EEF2FF` background for header wordmark.

### Completion Notes List

- Bootstrapped from `create-next-app -e with-supabase` into temp dir, merged into greenfield repo, pinned Spine versions (Next 16.2.10, React 19.2.7, Tailwind 4.3.3, `@supabase/*` pinned).
- Structural Seed: `app/`, `src/lib/supabase/`, `src/domain/`, `supabase/`; shadcn new-york kept under `src/components/ui`.
- Soft Workshop tokens + radii in `app/globals.css` (`@theme inline`); light-only (removed `next-themes`); RU UI copy throughout.
- AppShell + Create Menu landing («Новое меню») with pill-nav and primary nav; empty `warning-stale` slot reserved; no browser chrome.
- Session gate via `proxy.ts` + `src/lib/supabase/middleware.ts` using `getUser()`; Russian stub login; post-login → `/`.
- Optional local `KEPLO_DEV_BYPASS_AUTH=true` for shell inspection without a live Supabase project (documented in `.env.example`).
- Smoke: `npm run build` / `lint` pass; tokens + RU shell confirmed in browser; unauthenticated planning routes redirect; keyboard focus rings visible.

### File List

- `.env.example`
- `.gitignore`
- `README.md`
- `app/(authenticated)/history/page.tsx`
- `app/(authenticated)/layout.tsx`
- `app/(authenticated)/page.tsx`
- `app/(authenticated)/plan/menu/page.tsx`
- `app/(authenticated)/plan/portions/page.tsx`
- `app/(authenticated)/plan/shopping-list/page.tsx`
- `app/(authenticated)/settings/page.tsx`
- `app/auth/login/page.tsx`
- `app/favicon.ico`
- `app/globals.css`
- `app/layout.tsx`
- `components.json`
- `eslint.config.mjs`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `proxy.ts`
- `src/components/layout/app-header.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/pill-nav.tsx`
- `src/components/layout/primary-nav.tsx`
- `src/components/login-form.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/domain/.gitkeep`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`
- `src/lib/utils.ts`
- `supabase/.gitkeep`
- `tsconfig.json`
- `_bmad-output/implementation-artifacts/1-1-app-shell-with-soft-workshop-brand.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Implemented Story 1.1 — Next+Supabase greenfield shell with Soft Workshop brand, Create Menu landing, and auth redirect stub.
- 2026-07-20: Code review patches — Geist cyrillic subset, RU email placeholder, single focus-ring path. Status: done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created. Status: done.
