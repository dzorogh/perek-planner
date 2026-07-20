---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 1.5: Block planning on stale catalog

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want Menu planning blocked when catalog sync is stale or failed, with an explicit stale warning,
So that I do not build a Menu against a dead assortment.

## Acceptance Criteria

1. **Given** the latest `catalog_sync_runs` row for the active store indicates failure or non-fresh data (AD-8)  
   **When** the operator is on Create Menu, slot edit, or Portion plan  
   **Then** `warning-stale` is shown with explicit Russian copy that the catalog is outdated (FR16 / PRD FR-18, UX-DR10)  
   **And** Menu planning actions are blocked (e.g. generate Menu / continue planning CTAs disabled or rejected) — planning does not proceed on last-saved catalog alone

2. **Given** a successful fresh sync for the active store  
   **When** the operator returns to Create Menu / planning  
   **Then** `warning-stale` is cleared for that session state  
   **And** Menu planning actions are enabled again

3. **Given** catalog tables remain readable  
   **When** planning is blocked  
   **Then** Settings and sign-out remain available so the operator can wait for sync or change store context

## Tasks / Subtasks

- [x] Domain: catalog freshness from `catalog_sync_runs` only (AC: #1, #2)
  - [x] Add `src/domain/catalog/` helpers (AD-6: UI → domain → supabase) — e.g. `freshness.ts` + `constants.ts`
  - [x] Define **fresh** exactly as migration SoT already documents: latest run for the **active store** has `status = 'success'` **and** `finished_at >= now() - 24 hours` (UTC). Constant `CATALOG_FRESHNESS_WINDOW_HOURS = 24` (or equivalent) must match migration comments — do **not** invent a second TTL
  - [x] **Latest row** = for `store_id`, order by `started_at` desc, `limit(1)` + `maybeSingle()` (index `catalog_sync_runs_store_started_idx` already exists)
  - [x] **Active store** = `user_settings.selected_store_id` via existing `ensureUserStoreSettings` / settings helpers — do not invent a parallel store SoT
  - [x] Treat as **stale / non-fresh** (block planning): no rows; latest `failed`; latest `running`; latest `success` but outside the 24h window; missing `finished_at` on a terminal success (should not happen after 1.4 check constraint — still treat as non-fresh)
  - [x] **Fail-closed:** if the freshness SELECT errors, `selected_store_id` cannot be resolved, or the result is ambiguous → treat as **non-fresh** (show banner + block CTAs). Never fail-open to “fresh” on read failure
  - [x] Export a pure predicate usable by UI **and** future server actions (e.g. `getCatalogFreshness(supabase, storeId)` → `{ fresh: boolean; reason: ... }` and/or `assertCatalogFresh(...)` that returns a typed domain error). Story 2.1+ must be able to reject generate/continue on the server — do not UI-only gate
  - [x] **Forbidden freshness signals:** `products.updated_at`, product counts, client clocks alone, localStorage flags as SoT (AD-8)

- [x] UI: `warning-stale` banner (AC: #1, #2)
  - [x] Fill the existing AppShell slot: `data-slot="warning-stale"` in `src/components/layout/app-shell.tsx` (Story 1.1 left it empty on purpose)
  - [x] Component name / data attribute: `warning-stale` — prefer `src/components/catalog/warning-stale.tsx` (or `src/components/planning/warning-stale.tsx`)
  - [x] Soft Workshop tokens already in `app/globals.css`: `bg-warning-bg`, `text-warning-fg`, `border-warning-border`, `rounded-md` (12px). Circular icon badge using warning-border — see DESIGN.md `warning-stale`
  - [x] **Russian copy (required wording):** use EXPERIENCE voice — e.g. «Каталог устарел — планирование недоступно, пока не обновится.» Must include explicit «устарев» / catalog-outdated phrasing (NFR4 / a11y: not color-only). **Forbidden:** «Ошибка синхронизации» alone; «план строится по последнему сохранённому»
  - [x] Surfaces **only:** Create Menu `/`, slot edit `/plan/menu`, Portion plan `/plan/portions`. **Do not** show on Settings, History, or Shopping list (`/plan/shopping-list`) — UX-DR10 / EXPERIENCE State Patterns
  - [x] `aria-live="polite"` (slot already has it); banner must be keyboard-reachable context, not hover-only
  - [x] Load freshness in Server Component path (`app/(authenticated)/layout.tsx` or thin server helper) using user session client — pass into AppShell. Pathname gate for surfaces may be a thin client wrapper if needed
  - [x] Bypass-auth local mode (`KEPLO_DEV_BYPASS_AUTH`): do not crash shell; calm fallback (prefer treat as stale or hide banner with no fake “fresh” claim — document choice in completion notes)

- [x] Block Menu planning actions (AC: #1, #2)
  - [x] Create Menu (`app/(authenticated)/page.tsx`): when stale → keep «Сгенерировать» **disabled** (and not activatable). When fresh → **enable** the button for the stale-gate AC (Story 2.1 owns real generation; a no-op / stub click is OK until then, but must not stay disabled solely because of a hardcoded `disabled`)
  - [x] Slot edit / Portion plan stubs: if/when they expose continue/generate CTAs, wire the same `planningBlocked` prop; banner alone satisfies AC for pages with no planning CTA yet
  - [x] Do **not** implement Menu generation, matching, or OpenRouter here

- [x] Settings + sign-out remain available (AC: #3)
  - [x] Do not disable primary nav, Settings link, or `LogoutButton` when catalog is stale
  - [x] Do not redirect away from Settings/History when stale
  - [x] Changing store in Settings must revalidate shell so freshness recomputes for the new `selected_store_id` (extend `revalidatePath` in `updateSelectedStore` if layout-level freshness is cached — layout already revalidated in 1.3)

- [x] Smoke verification (AC: #1–#3)
  - [x] With latest run `failed` or success older than 24h (or no runs): `/`, `/plan/menu`, `/plan/portions` show `warning-stale`; «Сгенерировать» disabled; `/settings` + logout work
  - [x] After a successful sync with `finished_at` within 24h for the selected store: banner gone on planning surfaces; «Сгенерировать» enabled
  - [x] `/plan/shopping-list`, `/settings`, `/history` do not show the planning stale banner
  - [x] Optional: small script or manual SQL notes to flip a run to failed/old for QA (do not weaken RLS)
  - [x] `npm run lint` / `npm run build` green
  - [x] Soft Workshop brand unchanged; light-only; no dark mode / purple SaaS drift

### Review Findings

- [x] [Review][Patch] Dual freshness reads can disagree (banner vs Generate) — fixed via `getOperatorCatalogGate` (`React.cache`) shared by layout + Create Menu.
- [x] [Review][Patch] Freshness path not try/catch fail-closed — fixed inside `getOperatorCatalogGate` (fail-closed defaults on any throw / auth error).
- [x] [Review][Patch] Pathname gate is exact-match only — normalize trailing slash in `warning-stale-slot.tsx`.
- [x] [Review][Patch] Verify script incomplete vs predicate edges — added unknown status, unparseable `finished_at`, exact 24h boundary, just-outside cases.
- [x] [Review][Defer] Create Menu day radios are non-interactive stubs with hardcoded day 3 — deferred, pre-existing [`app/(authenticated)/page.tsx:57-77`]
- [x] [Review][Defer] Selected day uses indigo/purple shadow token drift — deferred, pre-existing stub styling (Story 2.1 menu UX) [`app/(authenticated)/page.tsx:67`]

## Dev Notes

### Epic context

Epic 1 — Sign in, workspace & store catalog. Stories **1.1–1.4 are done**. This story closes FR16 / PRD FR-18: explicit stale warning + block Menu planning until a fresh successful sync exists for the active store.

Sibling boundaries:
- **1.4 (done):** owns `products` + `catalog_sync_runs` writes via Python sync — **do not** reopen sync worker, availability mapping, or schedule docs unless a bug blocks freshness reads
- **1.3 (done):** Settings `store-picker` + `selected_store_id` — reuse; do not redesign Settings
- **2.1 (next):** Create Menu generation assumes Story 1.5 allows planning — call domain `assertCatalogFresh` from generate actions
- **Shopping list / History:** out of scope for banner surfaces

Traceability: Epics Story 1.5; PRD **FR-18**; UX **UX-DR10** + EXPERIENCE `warning-stale` + State Patterns; Architecture **AD-8** (primary), also AD-2 (Next read-only catalog), AD-5 (auth SELECT), AD-6 (domain placement), AD-9 (active store = Settings).

### Freshness contract (MUST — single SoT)

Documented in `supabase/migrations/20260720030000_products_catalog_sync_runs.sql`:

```text
fresh := latest catalog_sync_runs row for active store
         has status = 'success'
         AND finished_at >= now() - interval '24 hours' (UTC)
```

- SoT for stale signal: **`catalog_sync_runs` only** (AD-8)
- Never use `products.updated_at` / product presence as freshness
- “Session state cleared” in AC means: re-read DB on navigation/render; when a fresh success exists, banner and blocks clear — **not** a client-only sticky flag that ignores DB

### Current code state (READ before editing)

| Area | Today | This story | Must preserve |
| --- | --- | --- | --- |
| `src/components/layout/app-shell.tsx` | Empty `<div data-slot="warning-stale" aria-live="polite" />` | Render real banner into slot (gated by surface + freshness) | max-width shell, header, Soft Workshop |
| `app/(authenticated)/layout.tsx` | Auth gate + `resolveStoreLabel` → AppShell | Also resolve selected store + freshness; pass props | Bypass-auth rules; `getUser()`; no bounce on transient auth errors |
| `app/(authenticated)/page.tsx` | Create Menu stub; «Сгенерировать» always `disabled` | Wire `disabled={planningBlocked \|\| …}` so fresh enables CTA | Soft Workshop day-length chrome; no store picker (UX-DR5) |
| `app/(authenticated)/plan/menu/page.tsx` | Stub copy | Banner via shell; optional CTA wiring | No fake Menu generation |
| `app/(authenticated)/plan/portions/page.tsx` | Stub copy | Banner via shell; optional CTA wiring | No portion grid yet (Epic 3) |
| `app/(authenticated)/plan/shopping-list/page.tsx` | Stub | **No** warning-stale on this surface | Leave stub alone except avoiding accidental global banner |
| `src/domain/settings/*` | Store list, ensure default, update action | Reuse for active `store_id` | AD-9 semantics; null-only default upsert |
| `app/globals.css` | warning-* tokens already mapped | Use tokens; do not invent new warning palette | Lavender Workshop colors |
| `sync/` + catalog migrations | Done in 1.4 | **Read-only** from Next; no schema change required unless a bug | Service-role writes stay in sync only |
| Auth / Settings / Logout | Done | Must remain usable while planning blocked | Pill-nav + primary nav |

### Technical requirements (MUST follow)

| Item | Requirement |
| --- | --- |
| Stale SoT | Latest `catalog_sync_runs` for active store only (AD-8) |
| Fresh window | 24 hours UTC from `finished_at` on `success` — match migration comment |
| Active store | `user_settings.selected_store_id` (AD-9) |
| Catalog writes | None in Next (AD-2) |
| Query | Authenticated Supabase client; SELECT already allowed by RLS |
| Domain gate | Server-reusable freshness check for future generate actions |
| UI surfaces | `/`, `/plan/menu`, `/plan/portions` only |
| Copy | Russian; explicit outdated-catalog wording (EXPERIENCE) |
| A11y | Not color-only; focus rings; `aria-live` |
| Stack | Existing Next 16.2.10 / React 19.2.7 / Supabase JS 2.110.7 / Tailwind 4.3.3 — no new deps required |

### Architecture compliance

- **AD-8:** Single stale signal from `catalog_sync_runs`; block Menu planning (domain + UI) until fresh success for active store
- **AD-2:** Next reads catalog/sync markers; never writes them; never calls the store
- **AD-5:** `getUser()` session; authenticated SELECT on `catalog_sync_runs`
- **AD-6:** Helpers under `src/domain/catalog/`; column names match migrations (`status`, `finished_at`, `started_at`, `store_id`) — no DTO aliases
- **AD-9:** Freshness scoped to Settings-selected store; changing Settings does not rewrite past Menus (N/A until Menus exist)
- **AD-10:** Stale warning does **not** invalidate stored CheckedMatch rows (none exist yet) — do not build match invalidation here

### UX / brand

- DESIGN.md component `warning-stale`: full-width banner below header; warning tokens only for this catalog case
- EXPERIENCE: block generate/continue until fresh sync; Settings remain available
- Override vs older UX drafts that said “continue on last-saved catalog”: **epics + PRD FR-18 + UX memlog win — BLOCK planning** (do not implement last-saved continue)

### File structure requirements

**NEW (recommended):**

```text
src/domain/catalog/constants.ts      # CATALOG_FRESHNESS_WINDOW_HOURS = 24
src/domain/catalog/freshness.ts      # getCatalogFreshness / assertCatalogFresh
src/components/catalog/warning-stale.tsx
```

**UPDATE:**

```text
src/components/layout/app-shell.tsx
app/(authenticated)/layout.tsx
app/(authenticated)/page.tsx
# optionally plan/menu + plan/portions if wiring local CTAs
src/domain/settings/actions.ts      # only if revalidatePath needs expansion
```

**Do NOT create / do NOT implement:**

- Sync worker changes, new catalog migrations (unless proven bug)
- Menu generation / OpenRouter / matching / CheckedMatch
- Stock badges, in-app cart, Shopping-list stale wall
- Service role in Next or `NEXT_PUBLIC_*`
- Dark mode / second warning color system
- GitHub Actions / Supabase Cron (already out of scope)

### Library / framework requirements

- **Use:** existing `@supabase/ssr` server client, App Router RSC + existing Button/shadcn patterns
- **Query pattern:** `.from('catalog_sync_runs').select(...).eq('store_id', id).order('started_at', { ascending: false }).limit(1).maybeSingle()`
- **Do not add:** new npm packages for banners; toast libraries; client-only freshness caches as SoT

### Testing requirements

No Vitest mandated. Minimum for 1.5:

1. Manual or scripted: non-fresh store → banner on three planning surfaces + Generate disabled
2. Fresh success within 24h → banner cleared + Generate enabled
3. Settings + logout usable while stale
4. Shopping list / Settings / History: no planning `warning-stale`
5. `npm run lint` / `npm run build` green

### Previous story intelligence

**From 1.4 (catalog sync — done):**
- Freshness semantics already documented in migration comments for this story — implement them, do not redefine
- Index `(store_id, started_at desc)` ready for latest-row reads
- Terminal runs must have `finished_at` (check constraint migration `20260720030100_...`)
- Overlap guard may leave a `running` row briefly — treat `running` as non-fresh
- Next must not write catalog; RLS SELECT-only for authenticated proven by `scripts/verify-rls-catalog.mjs`
- Mock sync: `python -m sync --mock` / `--fail` useful to seed success/failed rows for QA

**From 1.3 (store picker — done):**
- Reuse `ensureUserStoreSettings` / `updateSelectedStore` / `DEFAULT_STORE_ID`
- Header store label pattern: load in authenticated layout, pass props into AppShell — mirror for freshness
- `revalidatePath("/", "layout")` already on store change — freshness should refresh with it
- Russian workshop errors; never raw SDK strings as sole UI copy
- Bypass-auth: calm Alabino fallback without crashing

**From 1.1 (shell — done):**
- Empty `warning-stale` slot reserved under header — fill it; do not invent a second banner location
- Warning CSS tokens already present — use them

[Source: `1-4-catalog-sync-worker.md`, `1-3-store-picker-in-settings.md`, `1-1-app-shell-with-soft-workshop-brand.md`]

### Git intelligence summary

Only commit on branch history: `e20cd4b Init`. Stories 1.1–1.4 exist as working-tree implementation. Follow established Soft Workshop + `src/domain/<area>/` patterns; keep Python `sync/` untouched unless a read-path bug forces a tiny fix.

### Latest tech information

- Supabase JS 2.110.7: prefer `.order(...).limit(1).maybeSingle()` for latest row; always check `error` (ambiguous multi-row + `maybeSingle` can look like “not found”)
- Freshness window comparison: compute in UTC against `finished_at` ISO strings from Postgres `timestamptz`
- No new framework upgrades required for this story

### Project context reference

No `project-context.md` in repo. Follow Architecture Spine + this story + prior Epic 1 story files.

### Anti-patterns (prevent disasters)

- Using `products.updated_at` or “any products exist” as freshness
- Showing banner on Shopping list / Settings / History
- Allowing Generate while stale (including client-only disable that server actions bypass later — add domain assert now)
- Fail-open on DB/read errors (treating unknown freshness as fresh)
- Copy that implies planning continues on last-saved catalog (mocks / old brief — EXPERIENCE + FR-18/CAP-15 override)
- Writing `catalog_sync_runs` from Next
- Hardcoding store id instead of Settings-selected store
- Replacing Soft Workshop warning tokens with destructive/red alert styling
- Editing 1.4 migrations in place — append only if schema truly must change
- Implementing Menu AI generation “while here”

### Open questions for implementer (non-blocking)

1. Exact Russian microcopy may use EXPERIENCE line verbatim or a short equivalent that still contains explicit outdated-catalog wording — prefer EXPERIENCE.
2. Whether bypass-auth without a user shows banner: prefer safe “stale/unknown” or omit; never claim fresh without a DB read.
3. Optional operator hint to check Dokploy sync / wait for cron — keep calm; do not expose service-role or internal URLs in UI.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.5]
- [Source: `prds/prd-keplo-2026-07-19/prd.md` — FR-18 Block planning when catalog is stale]
- [Source: `specs/spec-keplo/SPEC.md` — CAP-15 (same intent as FR-18; block, not last-saved continue)]
- [Source: `architecture/.../ARCHITECTURE-SPINE.md` — AD-8, AD-2, AD-5, AD-6, AD-9]
- [Source: `ux-designs/.../EXPERIENCE.md` — `warning-stale`, State Patterns, Voice & Tone, UJ-1 failure edge]
- [Source: `ux-designs/.../DESIGN.md` — `warning-stale` tokens / radii]
- [Source: `supabase/migrations/20260720030000_products_catalog_sync_runs.sql` — freshness comment]
- [Source: `1-4-catalog-sync-worker.md` — ingest handoff]
- [Source: `src/components/layout/app-shell.tsx` — reserved slot]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `node scripts/verify-catalog-freshness-logic.mjs` — 10/10 PASS
- `npm run lint` — green
- `npm run build` — green

### Completion Notes List

- Implemented AD-8 freshness in `src/domain/catalog/` (`evaluateCatalogRunFreshness`, `getCatalogFreshness`, `assertCatalogFresh` for Story 2.1+).
- Soft Workshop `warning-stale` banner fills AppShell slot; client pathname gate limits surfaces to `/`, `/plan/menu`, `/plan/portions`.
- Create Menu «Сгенерировать» disabled only when `planningBlocked` (stale/fail-closed); enabled when catalog is fresh (stub click until 2.1).
- Bypass-auth: `catalogFresh=false` / planning blocked — no fake fresh claim without DB read.
- Settings `revalidatePath("/", "layout")` from 1.3 already refreshes freshness after store change; nav/logout untouched.
- Slot edit / Portion plan: banner via shell; no local CTAs yet.
- Code review patches: `getOperatorCatalogGate` (`React.cache`) unifies layout/page freshness + fail-closed; pathname trailing-slash normalize; verify script edge cases expanded.

### File List

- `src/domain/catalog/constants.ts` (new)
- `src/domain/catalog/freshness.ts` (new)
- `src/domain/catalog/operator-catalog-gate.ts` (new)
- `src/components/catalog/warning-stale.tsx` (new)
- `src/components/catalog/warning-stale-slot.tsx` (new)
- `src/components/layout/app-shell.tsx`
- `app/(authenticated)/layout.tsx`
- `app/(authenticated)/page.tsx`
- `scripts/verify-catalog-freshness-logic.mjs` (new)
- `_bmad-output/implementation-artifacts/1-5-block-planning-on-stale-catalog.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-20: Ultimate context engine analysis completed — comprehensive developer guide created (ready-for-dev).
- 2026-07-20: Implemented stale-catalog gate + warning-stale UI; status → review.
- 2026-07-20: Code review patches applied; status → done.
