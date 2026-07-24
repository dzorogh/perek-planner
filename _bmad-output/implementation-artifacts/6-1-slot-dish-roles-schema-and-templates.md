---
baseline_commit: 6d7c2481bf997f4a1485aed43d063254198082f0
---

# Story 6.1: Slot dish roles schema and meal templates

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator (Sergey),
I want every meal to store role-labeled Slot dishes (including breakfast and snacks) with composition rules for Harvard plate and lunch soup,
So that the plan data matches how I eat and complex one-pots do not spawn duplicate sides.

## Acceptance Criteria

1. **Given** a Menu with breakfast, lunch, dinner, and snack (Перекус) selected  
   **When** slots are persisted  
   **Then** each meal uses the same Slot dish persistence (`MenuSlot` → `MenuSlotDish[]` with Plate role + Recipe or snack label)  
   **And** templates are: breakfast/second_breakfast → `[main]`; afternoon_snack (Полдник) → `[main]`; lunch → `[soup, protein, veg, carb]`; dinner/late_dinner → `[protein, veg, carb]`; snack (Перекус) → `[snack]` (FR3, FR27, FR29)

2. **Given** a multi-role Recipe (e.g. plov) with `covers_roles` including `protein` and `carb`  
   **When** composition helpers compute required open roles for lunch or dinner  
   **Then** covered roles are not required as separate Slot dishes  
   **And** uncovered required roles remain open to fill (FR26)

3. **Given** existing menus that used `menu_slots.recipe_id` / `companion_recipe_id` and/or `menu_snacks`  
   **When** migration + adapters run  
   **Then** `loadMenuSkeleton`, `buildShoppingList`, and history load expose all prior dishes/snacks via the Slot dish shape without dropping assignments (FR17 path preserved)

4. **Given** domain verify scripts  
   **When** the composition matrix runs  
   **Then** lunch soup role presence, Harvard second-course roles, breakfast/afternoon_snack/snack templates, and `coversRoles` skip-duplicate behavior PASS

## Tasks / Subtasks

- [x] Migration: `menu_slot_dishes` + `recipes.covers_roles` + meal enum `snack` + RLS + backfill (AC: #1, #3)
  - [x] Create `supabase/migrations/20260725030000_menu_slot_dishes_and_covers_roles.sql`
  - [x] Apply via Supabase MCP `apply_migration` in the same turn (project rule)
  - [x] Backfill cookable slots → dishes; backfill `menu_snacks` → `meal='snack'` slots + dish role `snack`
  - [x] `scripts/verify-rls-menu-slot-dishes.mjs` + wire into `npm run verify:rls`
- [x] Domain: meal templates + composition helpers (AC: #1, #2, #4)
  - [x] `src/domain/menu/meal-templates.ts` — `PlateRole`, `MEAL_TEMPLATES`, `rolesForMeal`, `openRolesAfterCovers`
  - [x] `src/domain/menu/composition.ts` — pure helpers for matrix (Harvard + soup + covers)
  - [x] `scripts/verify-meal-composition-logic.mjs` + wire into `npm run verify:logic`
- [x] Readers: load / shopping / history on dishes (AC: #3)
  - [x] `load-menu.ts` — `MenuSlotView.dishes[]`; keep thin compatibility fields for pre-6.3 UI if needed
  - [x] `build-list.ts` — iterate all dish `recipe_id`s + snack labels
  - [x] `load-history.ts` (+ batch-scale / dish-summary / suggestions history) — all dish recipe ids
- [x] Writers: dual-write so new assigns/snacks land in dishes (AC: #3)
  - [x] `assign.ts` (+ minimal sync from resuggest/clear paths) write `menu_slot_dishes`
  - [x] Snack create/replace paths write snack Slot dishes (stop being dishes-blind)
  - [x] Do **not** rewrite invent prompts / Harvard invent orchestration (Story 6.2)
  - [x] Do **not** ship role-labeled UI chrome (Story 6.3)
- [x] Gate: `npm run verify:logic` (incl. new script) + relevant `verify:rls` + lint/build as touched

### Review Findings

- [x] [Review][Patch] Fail assign when `replaceCookableDishes` fails [`src/domain/suggestions/assign.ts`:121]
- [x] [Review][Patch] `replaceCookableDishes`: avoid wipe-all-then-fail leaving empty dishes — delete only roles being rewritten or restore on upsert failure [`src/domain/menu/slot-dishes.ts`:51]
- [x] [Review][Patch] Merge snacks by day (dish label + menu_snacks fallback/nutrition) — no XOR drop [`src/domain/menu/load-menu.ts`:202]
- [x] [Review][Patch] Shopping: union dish recipes with slot `recipe_id`/`companion` for slots lacking dishes [`src/domain/shopping/build-list.ts`:75]
- [x] [Review][Patch] `clearCompanionForSlot`: check carb-dish delete error before `{ ok: true }` [`src/domain/suggestions/resuggest-slot.ts`]
- [x] [Review][Patch] History: scope dishes query to loaded slot ids; warn on dishes load error; add dish recipes into `scaleSlotsByMenu` [`src/domain/history/load-history.ts`]
- [x] [Review][Patch] `ensureSnackSlots`: on insert race/fail, re-select existing slot id for that day [`src/domain/menu/slot-dishes.ts`:119]
- [x] [Review][Defer] Wire `covers_roles` into invent/assign (not just helpers) — deferred to Story 6.2
- [x] [Review][Defer] Assign dual-write only persists protein(+carb); full Harvard soup/veg fill — deferred to Story 6.2
- [x] [Review][Defer] Inline duplicate templates in `verify-meal-composition-logic.mjs` — project verify-mjs pattern

## Dev Notes

### Epic context

Epic 6 delivers Harvard plate meal composition. **6.1 = data model + templates + adapters.** 6.2 = template-driven AI invent/assign. 6.3 = role-labeled UI + per-role edit.

### Critical: Полдник ≠ Перекус

| Concept | Template |
| --- | --- |
| **Полдник** `afternoon_snack` | `[main]` |
| **Перекус** `snack` | `[snack]` |

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Migration applied via Supabase MCP `menu_slot_dishes_and_covers_roles`
- `npm run verify:logic`, `verify:rls`, `tsc`, `eslint` (touched files), `npm run build` — PASS

### Completion Notes List

- Added `menu_slot_dishes` + `recipes.covers_roles` + meal `snack`; backfilled main→protein/main and companion→carb; snacks → snack slots+dishes.
- Code meal templates + composition helpers; dual-write from assign / clear companion / snack generate+resuggest.
- Load/shopping/history read dishes with legacy shim for pre-6.3 UI (main/companion fields).
- Create skeleton accepts `snack` when `includeSnacks`; meal picker still uses COOKABLE_MEAL_SLOTS + includeSnacks checkbox.

### File List

- `supabase/migrations/20260725030000_menu_slot_dishes_and_covers_roles.sql`
- `src/domain/menu/meal-templates.ts`
- `src/domain/menu/composition.ts`
- `src/domain/menu/slot-dishes.ts`
- `src/domain/menu/sync-snack-dishes.ts`
- `src/domain/menu/constants.ts`
- `src/domain/menu/load-menu.ts`
- `src/domain/suggestions/assign.ts`
- `src/domain/suggestions/generate-menu.ts`
- `src/domain/suggestions/generate-snacks.ts`
- `src/domain/suggestions/resuggest-slot.ts`
- `src/domain/shopping/build-list.ts`
- `src/domain/history/load-history.ts`
- `src/components/menu/meal-types-picker.tsx`
- `scripts/verify-meal-composition-logic.mjs`
- `scripts/verify-rls-menu-slot-dishes.mjs`
- `package.json`
- `_bmad-output/implementation-artifacts/6-1-slot-dish-roles-schema-and-templates.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-25: Implemented Slot dish schema, templates, adapters, dual-write; status → review.
- 2026-07-25: Applied all 7 code-review patches (assign fail, safe replace, snack merge, shopping union, clearCompanion, history scope/scale, ensureSnackSlots race); status → done.
