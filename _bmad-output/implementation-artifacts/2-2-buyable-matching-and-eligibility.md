---
baseline_commit: e20cd4b14f3783c6c3058b48dc677895355d90ac
---

# Story 2.2: Buyable matching and eligibility

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operator (Sergey),
I want Recipes eligible for a Menu only when Critical ingredients have in-stock Checked-match Products,
So that I do not plan dishes I cannot buy today.

## Acceptance Criteria

1. **Given** Critical ingredients on a Recipe and Products in the active store catalog  
   **When** the Next matching module runs for a Menu  
   **Then** it creates Menu-scoped normalized `CheckedMatch` rows (AD-3, AD-7)  
   **And** a Recipe is blocked from suggest/assign if any Critical ingredient lacks a Checked match (FR10 / PRD FR-11)

2. **Given** multiple suitable Product variants for an ingredient  
   **When** the matcher chooses among in-stock variants  
   **Then** it prefers a cheaper suitable analog at medium aggressiveness without collapsing below the basic quality heuristic (FR13, FR15 / PRD FR-15)  
   **And** if no in-stock variant exists for a Critical ingredient, the Recipe is not suggested or assignable (FR15 / PRD FR-17)

3. **Given** pantry/staple Products required for eligibility  
   **When** a required pantry Product is missing from the catalog  
   **Then** the Recipe can be ineligible (FR11 / PRD FR-13 gate only — list lines come in Epic 3)

4. **Given** Menu length N days and Recipe fridge-keep  
   **When** eligibility is evaluated  
   **Then** Recipes with fridge-keep shorter than N cannot be assigned; shortest selected fridge-keep caps allowable length (FR12 / PRD FR-14)

5. **Given** matching results  
   **When** the operator views planning UI  
   **Then** there is no match-review UI; Products surface later on the Shopping list (FR10 / PRD FR-11)

## Tasks / Subtasks

- [x] Schema: CriticalIngredient + CheckedMatch (+ seed recipes) (AC: #1, #3)
  - [x] Append migration(s) under `supabase/migrations/` (do not edit 2.1 migrations in place)
  - [x] `critical_ingredients`: `id`, `recipe_id` → `recipes`, `name` text (search/match key), pantry flag as `is_pantry boolean` **or** `kind text check in ('critical','pantry')` (pick one; spine-friendly `kind` preferred), `sort_order` int, timestamps. Unique `(recipe_id, name)`. No separate FridgeKeep table — use `recipes.fridge_keep_days` from 2.1
  - [x] `checked_matches`: Menu-scoped normalized rows (AD-7) — at least `id`, `menu_id` → `menus` on delete cascade, `recipe_id` → `recipes`, `critical_ingredient_id` → `critical_ingredients`, `product_id` → `products`, `menu_slot_id` nullable → `menu_slots` (null until slot assigned in 2.3/2.4), unique that prevents duplicate ingredient resolution per menu/recipe intent (e.g. unique `(menu_id, critical_ingredient_id)` **or** `(menu_id, menu_slot_id, critical_ingredient_id)` — pick one, document in comment; prefer `(menu_id, critical_ingredient_id)` for pre-assign matching in 2.2)
  - [x] RLS: `critical_ingredients` SELECT for authenticated (recipe library read); `checked_matches` owner-only via exists-join to `menus.user_id = auth.uid()`; grants/revokes like menus pattern; **only Next matching module writes matches** (authenticated insert/update/delete own; no anon)
  - [x] Seed **≥2** Recipes with Critical ingredients (incl. at least one `is_pantry=true`) and fridge_keep_days covering/not covering typical Menu lengths — enough for eligibility unit/smoke tests without OpenRouter
  - [x] Do **not** create Shopping list tables, Snack, Refusal, Rating, or match-review UI tables

- [x] Domain matching module (AC: #1–#4)
  - [x] Add `src/domain/matching/` — recommended split:
    - `constants.ts` — availability enum reuse (`in_stock`), medium-aggressiveness knobs (document numbers)
    - `eligibility.ts` — pure: fridge-keep vs `menu.day_count`; pantry missing → ineligible; all critical matched → eligible
    - `pick-product.ts` — pure: from candidate Products pick one using medium cheaper-analog heuristic on `price_cents` + basic quality bar
    - `match-recipe.ts` — load Recipe + criticals + Products for **Menu.store_id snapshot** (AD-9), run matcher, return `{ eligible, matches[], reason }`
    - `persist-matches.ts` / `actions.ts` — replace Menu-scoped matches for a Recipe (delete+insert or upsert); session client only
  - [x] **Availability SoT:** `products.availability_status = 'in_stock'` only (AD-8). Treat `out_of_stock` / `unknown` as not buyable today (PRD FR-17)
  - [x] **Store SoT for matching:** `menus.store_id` snapshot — never live Settings for an existing Menu (AD-9)
  - [x] **Freshness:** call `assertCatalogFresh(supabase, menu.store_id)` before matching runs that write (AD-8). Fail-closed
  - [x] **Candidate discovery (v1):** match Products for the Menu’s store by case-insensitive name containment / normalized token overlap against `critical_ingredients.name` (document algorithm). No external NLP. Prefer in-stock first, then apply price heuristic among suitable
  - [x] **Medium cheaper-analog (PRD FR-15):** among suitable in-stock candidates, prefer lower `price_cents` when gap is clear; skip candidates with null price when a priced alternative exists if that matches “basic quality” bar you define (e.g. reject names matching ultra-cheap junk tokens OR require price within N× median of candidates — pick a simple documented heuristic; do not always pick absolute cheapest if it fails the bar)
  - [x] **Fridge-keep:** Recipe ineligible when `fridge_keep_days < menu.day_count`. Export helper `maxMenuDaysForRecipes(fridgeKeepDays[])` / `shortestFridgeKeepCapsLength` for FR12 “shortest selected caps length”
  - [x] **Pantry gate:** if `is_pantry` critical has zero catalog candidates (any availability) for that store → Recipe ineligible (FR11 gate). List materialization is Epic 3
  - [x] Public API for Story 2.3+: e.g. `evaluateRecipeEligibility(supabase, menuId, recipeId)`, `matchAndPersistRecipe(supabase, menuId, recipeId)`, `assertRecipeAssignable(...)` throwing typed domain error. No UI-only gate
  - [x] When rematching a Recipe on a Menu, replace prior `checked_matches` for that `(menu_id, recipe_id)` set — do not leave stale product links (AD-10 slot-replace prep)

- [x] No match-review UI (AC: #5)
  - [x] Do not add operator UI to approve/edit matches, stock badges, or product pickers on Create Menu / slot edit
  - [x] Optional: zero UI change is OK for 2.2 if domain + migration + verify scripts satisfy ACs — **preferred**. If a tiny admin/dev-only smoke page is added, it must not ship as planning UX
  - [x] Soft Workshop planning surfaces unchanged except accidental breakage fixes
  - [x] Do **not** invent a shopper-facing “why ineligible” / match-failure panel — EXPERIENCE has no such pattern; reason codes stay in domain errors for 2.3+ callers

- [x] Smoke / verification (AC: #1–#5)
  - [x] Pure-logic script(s) for fridge-keep gate, pantry missing → ineligible, cheaper-analog pick, in_stock-only (mirror domain predicates like catalog freshness verify)
  - [x] Optional DB smoke: seed recipe eligible vs ineligible against mock/synced products for Alabino store
  - [x] RLS: anon denied on `checked_matches`; owner policies present
  - [x] `npm run lint` / `npm run build` green
  - [x] Confirm no OpenRouter, no Shopping list snapshot, no slot AI fill

### Review Findings

- [x] [Review][Patch] Fix false-positive name match — whole-token match (blocks «соль»⊂«фасоль»).
- [x] [Review][Patch] Near-tie prefers cheaper then id.
- [x] [Review][Patch] Atomic `replace_checked_matches` RPC; clear failures checked.
- [x] [Review][Patch] Paginated product catalog load (1000/page).
- [x] [Review][Patch] Empty/pantry-only → `missing_match`; negative prices filtered.
- [x] [Review][Patch] Consistency trigger + hardening migration `20260720050100_…`.
- [x] [Review][Defer] FR12 multi-recipe length cap helper unused at runtime — deferred until multi-assign UI (2.3/2.4); per-recipe fridge gate is implemented
- [x] [Review][Defer] Verify script mirrors TS predicates — deferred, same pattern as catalog freshness smoke
- [x] [Review][Defer] `assertRecipeAssignable` mutates DB — deferred, intentional for 2.3 assign path; add read-only assert later if needed

## Dev Notes

### Epic context

Epic 2 — Plan a buyable Menu. **2.1 done** (Menu skeleton + empty slots + recipes table with `fridge_keep_days`). This story owns the **matching & eligibility engine** that 2.3 must call before assigning AI Recipes to slots.

**FR id map:** Epics inventory renumbers vs PRD — epics FR10≈PRD FR-11 (Checked match), epics FR11≈PRD FR-13 (pantry gate), epics FR12≈PRD FR-14 (fridge-keep), epics FR13/FR15≈PRD FR-15/FR-17 (analogs / today-stock). PRD FR-10 is Rating (not this story).

Sibling boundaries:
- **2.1 (done):** Menu/MenuSlot/Recipe shell — reuse; do not reopen skeleton UX
- **2.3:** OpenRouter generate; calls 2.2 gates before assign; loading UX
- **2.4:** Slot edit / resuggest / UJ-1 gate; re-match on replace (AD-10)
- **2.5 / 2.6:** Snacks, Refusal
- **Epic 3:** Shopping list lines from CheckedMatch + pantry lines default-on

### Current code state (READ before editing)

**Already exist:**
- `recipes` (`id`, `name`, `fridge_keep_days`) — minimal; no ingredients yet
- `menus.store_id` snapshot + freeze trigger; `menu_slots` empty
- `products` with `availability_status` (`in_stock`|`out_of_stock`|`unknown`), `price_cents`, `store_id`, `name`
- `assertCatalogFresh` / `getOperatorCatalogGate` / RPC create skeleton with in-SQL freshness

**Missing:** `critical_ingredients`, `checked_matches`, matching domain module, recipe seeds with ingredients.

### Technical requirements (MUST follow)

| Topic | Rule |
| --- | --- |
| Layering | Matching only in `src/domain/matching/` → session Supabase (AD-3, AD-6). No DB functions that own eligibility logic (AD-3 prevents dual ownership). Persistence of match **rows** is OK via SQL; **choice** of product is Next TypeScript |
| CheckedMatch | Normalized table, Menu-scoped (AD-7). Never JSON blob on `menu_slots` |
| Store | Match against `menus.store_id`, not Settings (AD-9) |
| Availability | Single field `availability_status`; buyable today ⇒ `in_stock` (AD-8 / FR-17) |
| Freshness | Assert fresh before match writes; stale blocks planning already in UI |
| Catalog writes | Forbidden from Next (AD-2) |
| Heuristic | Document medium aggressiveness constants in `constants.ts`; keep deterministic for tests |
| Errors | Typed domain errors (e.g. `RecipeIneligibleError` with reason codes: `fridge_keep`, `missing_match`, `pantry_missing`, `not_in_stock`, `stale_catalog`) + Russian messages at any UI boundary |
| Dependencies | No new npm packages unless unavoidable |

### Architecture compliance

- **AD-3:** One matching module on Next server  
- **AD-7:** Normalized Menu-scoped `CheckedMatch`  
- **AD-8 / AD-9 / AD-10:** Freshness, store snapshot, rematch-on-replace prep  
- **AD-4 / AD-11:** Out of scope (OpenRouter, Shopping list snapshot)

[Source: `ARCHITECTURE-SPINE.md` — AD-3, AD-7, AD-10, ERD]

### UX / brand

- **Forbidden:** match-review UI, stock badges, Pantry screen, per-item pantry prompt (EXPERIENCE Scope + Voice)  
- Operator still sees Soft Workshop Create Menu / empty day-cards from 2.1; Products appear on Shopping list in Epic 3  
- No new planning chrome required for 2.2  

[Source: `EXPERIENCE.md` — Scope boundaries, Glossary Pantry item]

### File structure requirements

**NEW (recommended):**

```text
supabase/migrations/YYYYMMDDHHMMSS_critical_ingredients_checked_matches.sql
src/domain/matching/constants.ts
src/domain/matching/eligibility.ts
src/domain/matching/pick-product.ts
src/domain/matching/match-recipe.ts
src/domain/matching/persist-matches.ts
src/domain/matching/errors.ts
scripts/verify-matching-logic.mjs
scripts/verify-rls-checked-matches.mjs   # optional but preferred
```

**UPDATE only if needed:** none required on Create Menu UI.

**Do NOT implement:**

- OpenRouter / AI suggestion fill  
- Match-review or product-picker UI  
- Shopping list materialization / copy  
- Stock badges, in-app cart, Pantry management screen  
- Refusal / Rating hard-suppress (2.6 / Epic 4) — leave hooks comments only if useful  
- Global Recipe×Store match cache (violates AD-7)  
- Service role in Next browser path  

### Library / framework requirements

- Stack unchanged: Next 16 / React 19 / Supabase JS 2.110 / session `createClient`  
- Prefer pure functions + small integration functions for testability without Vitest mandate  
- Deterministic matcher (stable sort by price, then `external_id` / `id`) so smokes don’t flake  

### Testing requirements

No Vitest mandated. Minimum for 2.2:

1. Fridge-keep: `fridge_keep_days < day_count` → ineligible  
2. Missing critical match / OOS-only candidates → ineligible  
3. Pantry critical with zero catalog hits → ineligible  
4. Two in-stock priced candidates → medium heuristic picks documented winner  
5. `checked_matches` rows Menu-scoped; anon RLS deny  
6. `npm run lint` / `npm run build` green  

### Previous story intelligence

**From 2.1 (done):**
- Reuse `menus.store_id` snapshot + `recipes.fridge_keep_days`  
- Pattern: domain helpers + `"use server"` only when mutation needed; typed `{ ok, error }` / thrown domain errors  
- Review hardening: freeze snapshot columns; fail-closed loads; RPC cannot bypass freshness — matching writes should similarly not be bypassable without freshness assert  
- Empty `DayCardGrid` ignores `recipeId` until 2.3 — do not “fix” filled chrome here  
- Deferred: cross-user RLS harness, double-submit idempotency  

**From 1.4 / 1.5:**
- Products SELECT-only for authenticated; availability_status is the only stock signal  
- `assertCatalogFresh` is the planning gate  

[Source: `2-1-create-menu-skeleton-by-day-length.md`, products migration]

### Git intelligence summary

Single commit history `e20cd4b Init`; Epic 1–2.1 live in working tree. Follow `src/domain/<area>/` + append-only migrations.

### Latest tech information

- Supabase: filter products `.eq('store_id', menu.storeId).eq('availability_status', 'in_stock')`; always check `error`  
- Price heuristic: integer `price_cents`; null prices sort last among otherwise suitable  
- No new framework upgrades  

### Project context reference

No `project-context.md`. Follow Architecture Spine + this story + 2.1 file.

### Anti-patterns (prevent disasters)

- Match-review UI or stock badges “for debugging” left in planning shell  
- JSON matches on `menu_slots` instead of `checked_matches`  
- Matching against Settings store instead of Menu snapshot  
- Using `products.updated_at` or counts as eligibility  
- Global match cache shared across Menus  
- Implementing Shopping list lines “while here”  
- Calling OpenRouter from matching module  
- Fail-open when catalog stale or product query errors  
- Editing 2.1 migrations in place  

### Open questions for implementer (non-blocking)

1. Name-matching aggressiveness (substring vs token set) — prefer simple ILIKE/`includes` on normalized lowercase names; document false-positive risk  
2. Whether `menu_slot_id` on CheckedMatch stays null until 2.3 assign — yes, recommended for 2.2 pre-assign API  
3. Seed product rows: only if local DB lacks catalog; otherwise rely on sync mock / existing products for Alabino  

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2]
- [Source: `prds/prd-keplo-2026-07-19/prd.md` — FR-11…FR-15, FR-17]
- [Source: `architecture/.../ARCHITECTURE-SPINE.md` — AD-3, AD-7, AD-9, AD-10]
- [Source: `ux-designs/.../EXPERIENCE.md` — no match-review UI, Pantry glossary]
- [Source: `supabase/migrations/20260720030000_products_catalog_sync_runs.sql`]
- [Source: `2-1-create-menu-skeleton-by-day-length.md`]
- [Source: `src/domain/catalog/freshness.ts`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- `node scripts/verify-matching-logic.mjs` — PASS
- `node --env-file=.env.local scripts/verify-rls-checked-matches.mjs` — PASS
- `npx eslint src/domain/matching` — green
- `npm run build` — green
- Supabase MCP `apply_migration` `critical_ingredients_checked_matches` — success
- Supabase MCP `apply_migration` `checked_matches_hardening` — success

### Completion Notes List

- Migration: `critical_ingredients` (`kind` critical|pantry), Menu-scoped `checked_matches` unique `(menu_id, critical_ingredient_id)`, seed recipes long/short fridge-keep.
- Domain `src/domain/matching/`: fridge-keep + pantry presence + in-stock gates; medium cheaper-analog on `price_cents`; name match with RU prefix; `evaluateRecipeEligibility` / `matchAndPersistRecipe` / `assertRecipeAssignable` (+ freshness assert).
- No match-review UI (domain-only story). Verify scripts for logic + anon RLS.
- Review patches: whole-token name match, near-tie price order, atomic replace RPC, paginated catalog, empty/pantry-only reject, consistency trigger.

### File List

- `supabase/migrations/20260720050000_critical_ingredients_checked_matches.sql` (new)
- `supabase/migrations/20260720050100_checked_matches_hardening.sql` (new)
- `src/domain/matching/constants.ts` (new)
- `src/domain/matching/errors.ts` (new)
- `src/domain/matching/eligibility.ts` (new)
- `src/domain/matching/pick-product.ts` (new)
- `src/domain/matching/persist-matches.ts` (new)
- `src/domain/matching/match-recipe.ts` (new)
- `src/domain/matching/index.ts` (new)
- `scripts/verify-matching-logic.mjs` (new)
- `scripts/verify-rls-checked-matches.mjs` (new)
- `_bmad-output/implementation-artifacts/2-2-buyable-matching-and-eligibility.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

### Change Log

- 2026-07-20: Story context created (ready-for-dev).
- 2026-07-20: Implemented matching module + schema; status → review.
- 2026-07-20: Code review patches applied; status → done.
