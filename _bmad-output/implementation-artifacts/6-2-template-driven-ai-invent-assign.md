---
baseline_commit: 6d7c2481bf997f4a1485aed43d063254198082f0
---

# Story 6.2: Template-driven AI invent and assign

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator (Sergey),
I want generation to fill a fixed meal structure decided in code,
So that the model spends capacity on suitable recipes, not inventing meal architecture.

## Acceptance Criteria

1. **Given** create-menu or resuggest invent runs for selected cookable meals  
   **When** the planner expands work for the AI  
   **Then** open Plate roles are emitted from code meal templates (`rolesForMeal` / `openRolesAfterCovers`) **before** invent/expand  
   **And** prompts ask for Recipe content per role slot (optional `covers_roles` on one-pots) — **not** free-form `plateKind` / `needs_companion` meal architecture (PRD FR-27 / epics FR28, FR7; AD-4, AD-12)

2. **Given** lunch is in the meal selection  
   **When** invent+assign completes successfully for a lunch slot  
   **Then** `menu_slot_dishes` for that slot covers lunch template roles `[soup, protein, veg, carb]` subject to `covers_roles` compression (empty roles still allowed) (PRD FR-25/FR-26)

3. **Given** dinner or late_dinner is in the meal selection  
   **When** invent+assign completes successfully  
   **Then** dishes cover Harvard second-course roles `[protein, veg, carb]` and **no** soup role is required or invented for those meals (PRD FR-25/FR-26)

4. **Given** Refusal / dislike hard-suppress and fridge-keep eligibility  
   **When** invent/assign places Recipes into role slots (generate-menu, resuggest-slot, any invent path)  
   **Then** those gates still apply on every path before persist/assign (FR6, FR7, FR8, AD-3, AD-4)

5. **Given** a complex one-pot Recipe persisted with `covers_roles` (e.g. plov → protein+carb)  
   **When** assign normalizes the plate for lunch or dinner  
   **Then** duplicate invent/assign for covered roles is skipped  
   **And** uncovered template roles remain fillable (e.g. lunch still needs soup + veg) (PRD FR-25; AD-12)

6. **Given** domain verify scripts  
   **When** invent/assign role-emission and Harvard persistence matrix runs  
   **Then** cases PASS: code emits lunch soup+Harvard; dinner never requires soup; `covers_roles` skips covered roles; assign writes soup/veg (not protein+carb only); Полдник≠Перекус templates unchanged

## Tasks / Subtasks

- [x] Role-slot emitter (pure) before AI (AC: #1, #5, #6)
  - [x] Add helper (e.g. `src/domain/suggestions/role-slots.ts` or under `menu/`) that, for a `TemplateMeal`, returns ordered open roles from `rolesForMeal` + optional prior `covers_roles`
  - [x] Unit-style cases in `scripts/verify-suggestions-logic.mjs` and/or extend `verify-meal-composition-logic.mjs` (no network)
- [x] Kill `plateKind` architecture invent (AC: #1)
  - [x] Rewrite `plan-menu-names.ts` plan shape: per code-emitted `{ meal, dayPair, plate_role, name, covers_roles? }` — remove `role: main|companion` + `plate_kind`
  - [x] Rewrite `expand-menu-recipes.ts` / invent drafts: `plate_role` ∈ PlateRole; persist `covers_roles` onto `recipes`
  - [x] Rewrite `invent-recipes.ts`, `invent-for-position.ts` system/user prompts + parsers — drop `plate_kind` / companion architecture language; invent content for a given role
  - [x] Rewrite `openrouter-generate.ts` assign schema away from authoritative AI `plateKind`; assign only into code-emitted role slots with persisted recipe ids
  - [x] Slim or replace `plate-complete.ts` / companion-pairing in `variety.ts` / `generate-menu.ts` / `resuggest-slot.ts` so structure comes from templates + `covers_roles`, not AI plateKind
- [x] Full Harvard persistence on assign (AC: #2, #3, #5)
  - [x] Extend `slot-dishes.ts`: replace/upsert full cookable dish set for a slot (`SlotDishWrite[]` for soup/protein/veg/carb/main) — do **not** stop at protein(+carb) legacy map
  - [x] Wire `assign.ts` + generate-menu / resuggest proposal builders to write all filled roles; keep thin legacy FK shim (`recipe_id` ← primary protein/main, `companion_recipe_id` ← carb when present) for pre-6.3 UI
  - [x] Persist `covers_roles` when inventing multi-role recipes; use `openRolesAfterCovers` so covered roles are not invented again
- [x] Preserve gates on every path (AC: #4)
  - [x] Audit generate-menu, resuggest-slot, invent-for-position, invent-recipes, openrouter-generate: hard-suppress + fridge-keep still before assign
  - [x] Still: invent → persist → assign **only** persisted ids; OpenRouter server-only
- [x] Snacks / breakfast boundaries (AC: #1, #6)
  - [x] Breakfast / second_breakfast / afternoon_snack (Полдник): invent/assign **`main` only** — morning-food rules stay; never soup/Harvard invent
  - [x] Перекус (`snack`): keep existing snack pipeline (`generate-snacks` / `upsertSnackDish`); do **not** run Harvard invent on snack
  - [x] Do **not** confuse Полдник (`afternoon_snack` → `[main]`) with Перекус (`snack` → `[snack]`)
- [x] Explicit out of scope
  - [x] Do **not** ship role-labeled Menu UI / per-role overflow chrome (Story 6.3)
  - [x] Do **not** re-migrate schema / re-define `MEAL_TEMPLATES` (Story 6.1 done — reuse)
  - [x] Do **not** narrate abandoned companion/гарнир scope in user-facing copy
- [x] Gate: `npm run verify:logic` (+ `verify:rls` if dishes RLS touched) + lint/tsc/build as touched

### Review Findings

- [x] [Review][Patch] Resuggest/modify must merge existing non-replaced `menu_slot_dishes` (soup/veg) before `replaceSlotDishes` — otherwise lunch Harvard sides are wiped [`src/domain/suggestions/resuggest-slot.ts`:672]
- [x] [Review][Patch] `dropHeavyHeavyCompanions`: skip when protein and carb share the same recipeId (one-pot covers) [`src/domain/suggestions/generate-menu.ts`:397]
- [x] [Review][Patch] `replaceSlotDishes`: if all writes filtered out, return false and do not delete template roles [`src/domain/menu/slot-dishes.ts`:51]
- [x] [Review][Patch] Adapt legacy/fallback dish roles to meal template (breakfast-family → `main`, not hard-coded `protein`) before persist [`src/domain/suggestions/assign.ts`:150]
- [x] [Review][Patch] `parsePositionNamePlanJson`: require exact `plateRole` match — do not remap `atPosition[0]` [`src/domain/suggestions/plan-menu-names.ts`:686]
- [x] [Review][Patch] `loadMenuPlanDishes`: include soup/veg from `menu_slot_dishes` for variety/keepDishes [`src/domain/suggestions/resuggest-slot.ts`:164]
- [x] [Review][Patch] Validate `covers_roles` against meal template (ignore out-of-template / snack claims in completeness) [`src/domain/suggestions/role-slots.ts` / `plan-menu-names.ts`]
- [x] [Review][Patch] OpenRouter assign payload: emit code `openRoles` per slot (not only `allowsCompanion`) [`src/domain/suggestions/openrouter-generate.ts`]
- [x] [Review][Patch] Prefer cover-declaring dishes when flattening expanded group (avoid first-wins dropping one-pot covers) [`src/domain/suggestions/generate-menu.ts`:358]
- [x] [Review][Patch] User-facing resuggest errors: stop saying «компаньон» — use role language [`src/domain/suggestions/resuggest-slot.ts`]
- [x] [Review][Patch] Verify: lunch invent/assign write-set must not stop at protein+carb only (negative AC#6) [`scripts/verify-suggestions-logic.mjs`]
- [x] [Review][Defer] Non-atomic `menu_slots` FK update before `replaceSlotDishes` — pre-existing dual-write pattern [`src/domain/suggestions/assign.ts`:190]
- [x] [Review][Defer] `inventAndPersistRecipes` still free-mixes roles — not on create-menu path [`src/domain/suggestions/invent-recipes.ts`]

## Dev Notes

### Epic context

Epic 6 = Harvard plate + uniform Slot dishes.  
**6.1 done:** schema, templates, composition helpers, readers, dual-write shim.  
**6.2 this story:** invent/plan/expand/assign orchestration — code emits roles; AI fills recipes.  
**6.3 later:** `slot-dish-line` RU labels + per-role edit UI (UX-DR17).

### Critical: code owns structure

| Owner | Responsibility |
| --- | --- |
| **Code** | Meal templates, open roles after covers, which roles to invent |
| **AI** | Recipe name/body/ingredients/nutrition/`covers_roles` claim for a given role |
| **Forbidden** | AI inventing free-form meal architecture via `plateKind` / companion pairing |

### Critical: Полдник ≠ Перекус

| Concept | Meal key | Template |
| --- | --- | --- |
| **Полдник** | `afternoon_snack` | `[main]` |
| **Перекус** | `snack` | `[snack]` |

### Templates SoT (reuse — do not fork)

`src/domain/menu/meal-templates.ts`:

- breakfast / second_breakfast / afternoon_snack → `[main]`
- lunch → `[soup, protein, veg, carb]`
- dinner / late_dinner → `[protein, veg, carb]`
- snack → `[snack]`

APIs: `rolesForMeal`, `openRolesAfterCovers`, `sortOrderForRole`, `isPlateRole`, `isTemplateMeal`.  
Composition: `src/domain/menu/composition.ts` (`requiredOpenRoles`, `rolesCoverRequirements`, `lunchRequiresSoup`, …).

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Migration `recipes_plate_role_harvard` applied via Supabase MCP
- `npm run verify:logic`, `npx tsc --noEmit`, eslint on suggestions, `npm run build` — PASS

### Completion Notes List

- Added `role-slots.ts` (`emitRoleSlots`, covers helpers, `legacyFksFromDishes`) and `replaceSlotDishes` for full Harvard write-set.
- Plan/expand/invent/resuggest prompts now use code-emitted `plate_role` + optional `covers_roles`; `plateKind` / companion architecture removed from invent prompts.
- `ProposedAssignment.dishes[]` is source for assign; every dish id gated by hard-suppress + fridge-keep; legacy `recipe_id`/`companion_recipe_id` shim kept for pre-6.3 UI.
- Verify composition extended with emitRoleSlots matrix; suggestions verify updated off plateKind suite.
- UI role labels deferred to 6.3; snack pipeline untouched; Полдник≠Перекус preserved.

### File List

- `supabase/migrations/20260725040000_recipes_plate_role_harvard.sql`
- `src/domain/suggestions/role-slots.ts`
- `src/domain/menu/slot-dishes.ts`
- `src/domain/suggestions/plan-menu-names.ts`
- `src/domain/suggestions/expand-menu-recipes.ts`
- `src/domain/suggestions/invent-recipes.ts`
- `src/domain/suggestions/invent-for-position.ts`
- `src/domain/suggestions/assign.ts`
- `src/domain/suggestions/generate-menu.ts`
- `src/domain/suggestions/analyze-menu-variety.ts`
- `src/domain/suggestions/plate-complete.ts`
- `src/domain/suggestions/openrouter-generate.ts`
- `src/domain/suggestions/variety.ts`
- `src/domain/suggestions/resuggest-slot.ts`
- `src/domain/suggestions/index.ts`
- `src/domain/suggestions/candidates.ts`
- `src/domain/suggestions/rank.ts`
- `scripts/verify-meal-composition-logic.mjs`
- `scripts/verify-suggestions-logic.mjs`
- `_bmad-output/implementation-artifacts/6-2-template-driven-ai-invent-assign.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-25: Template-driven invent/assign — code emits Plate roles, AI fills recipes + covers_roles, full Harvard dish persistence; status → review.
- 2026-07-25: Applied all 11 code-review patches (resuggest merge, one-pot heavy guard, replaceSlotDishes empty-guard, meal-adapt, exact plateRole, plan dishes load, covers filter, openRoles payload, flatten order, RU copy, verify AC6); status → done.
