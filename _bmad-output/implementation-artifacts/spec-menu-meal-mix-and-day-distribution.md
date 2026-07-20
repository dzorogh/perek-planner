---
title: 'Menu meal mix and day distribution'
type: 'bugfix'
created: '2026-07-20'
status: 'done'
baseline_commit: 'e4a953831e39798fa2f7ae00ac70079b81f8866d'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiate">

## Intent

**Problem:** Menus put breakfast-style dishes (сырники, творожные запеканки) on lunch/dinner and under-deliver meat/fish mains, so the week feels like casseroles/snacks instead of home dinners — even when invent returned a meat dish that never got assigned.

**Approach:** Code-first meal-fit + invent post-filters so lunch/dinner pools exclude morning food and require heavy animal protein coverage; tighten invent prompts; keep Model C recipe reuse across days.

## Boundaries & Constraints

**Always:**
- Lunch/dinner main pools exclude `looksLikeBreakfastDish`; breakfast slots keep rejecting lunch/dinner-only mains.
- When meals include lunch and/or dinner, invent+assign must place ≥1 `looksLikeHeavyAnimalProteinDish` main into a lunch or dinner slot.
- Potato/meat dinner bakes stay valid L/D; only morning-form dishes are blocked from L/D.
- Create-flow stays invent → persist → deterministic assign; do not switch create-flow to LLM assign.
- Model C batch reuse across days stays (`MIN_BATCH_SLOT_RATIO` unchanged).
- Mirror new rules in `scripts/verify-suggestions-logic.mjs`.

**Ask First:**
- Lowering `MIN_BATCH_SLOT_RATIO` below 0.5.
- Persisting `suitable_meals` (DB migration).
- Requiring meat/fish on every L/D plate (broader than “≥1 meat/fish main on the menu”).

**Never:**
- Soft-trust invent `suitable_meals` without name-based guards.
- UI / schema / shopping-list changes.
- Full culinary ontology or variety-engine rewrite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Breakfast in L/D pool | сырники + куриные фрикадельки; lunch | Lunch main = non-breakfast (фрикадельки) | Do not assign breakfast as L/D main; leave unfilled if no L/D-eligible main |
| Meat invent unused | Meatballs + breakfast mains; B/L/D menu | ≥1 L/D slot uses heavy animal protein main | N/A |
| Dinner bake | «Запеканка из картофеля с фаршем» | Eligible L/D main | N/A |
| Morning casserole | «Гречневая запеканка с творогом» | Breakfast-only; never L/D main | Drop from L/D invent keep / assign |
| Breakfast slot | Roast chicken / plov | Still rejected (existing) | N/A |
| Batch reuse | Same chicken dinner day1+day2 | Allowed | N/A |
| Invent meat miss | Lunch/dinner requested; keep has 0 heavy-animal mains | One invent retry; then fail clearly rather than meat-free menu | Surface existing invent/assign error path |

</frozen-after-approval>

## Code Map

- `src/domain/suggestions/meal-fit.ts` -- `mainsForMeal` returns all mains for L/D today; exclude breakfast forms
- `src/domain/suggestions/variety.ts` -- uses `mainsForMeal`; confirm `enforceDayVariety` / batch ratio still work with smaller pools
- `src/domain/suggestions/invent-recipes.ts` -- prompt + post-filter meat quota / breakfast-form drop; optional one retry
- `src/domain/suggestions/generate-menu.ts` -- after invent, ensure L/D menus get a heavy-animal main or retry/fail
- `src/domain/suggestions/plate-complete.ts` -- keep plate pairing guards; no every-plate meat unless Ask First
- `src/domain/suggestions/openrouter-generate.ts` -- deterministic create assign path
- `scripts/verify-suggestions-logic.mjs` -- mirror matrix cases

## Tasks & Acceptance

**Execution:**
- [x] `src/domain/suggestions/meal-fit.ts` -- Non-breakfast `mainsForMeal` excludes `looksLikeBreakfastDish` (empty over breakfast fallback) -- stop morning food on L/D
- [x] `src/domain/suggestions/invent-recipes.ts` -- Prompt: L/D mains prefer meat/fish; breakfast forms not for L/D; post-filter + ≥1 heavy-animal main when L/D in meals; one retry -- invent quality
- [x] `src/domain/suggestions/generate-menu.ts` -- If L/D requested and assign pool lacks heavy-animal main, retry invent or fail clearly -- no silent meat-free create
- [x] `src/domain/suggestions/variety.ts` -- Only if L/D filter breaks batch ratio enforcement -- preserve Model C
- [x] `scripts/verify-suggestions-logic.mjs` -- Cover I/O matrix cases -- regression guard

**Acceptance Criteria:**
- Given сырники and куриные фрикадельки in pool, when assigning lunch/dinner, then main is never `looksLikeBreakfastDish`.
- Given invent kept ≥1 heavy animal protein main and meals include lunch/dinner, when create assign runs, then ≥1 L/D slot uses a heavy animal protein main.
- Given «Гречневая запеканка с творогом», when keeping invent drafts for B/L/D, then it is not a lunch/dinner main.
- Given «Запеканка из картофеля с фаршем», when assigning L/D, then it remains eligible.
- Given multi-day menu, when same dinner main spans days, then batch reuse remains allowed.

## Spec Change Log

## Design Notes

Root causes: (1) `mainsForMeal` does not exclude breakfast for L/D; (2) `suitable_meals` is never persisted/used; (3) plate “protein” accepts egg/dairy/mushroom, invent meat preference is soft; (4) batch ratio reuses ids by design — keep it.

L/D OK: фрикадельки, картофельная запеканка с фаршем, плов. Breakfast-only: сырники, творожные оладьи, гречневая запеканка с творогом.

## Verification

**Commands:**
- `npm run verify:logic` -- new meal-mix cases pass
- `npm run lint` -- clean on touched files

**Manual checks (if no CLI):**
- Create 3-day B/L/D menu (with каши bans): L/D show meat/fish mains; no сырники/творожная запеканка as L/D mains.

## Suggested Review Order

**Meal-fit gate**

- Lunch/dinner mains exclude morning forms; полдник keeps full pool
  [`meal-fit.ts:10`](../../src/domain/suggestions/meal-fit.ts#L10)

- `mainsForMeal` applies breakfast exclusion only via `isLunchDinnerMeal`
  [`meal-fit.ts:177`](../../src/domain/suggestions/meal-fit.ts#L177)

**Invent meat quota**

- Prompt requires ≥1 meat/fish main when L/D in meals
  [`invent-recipes.ts:108`](../../src/domain/suggestions/invent-recipes.ts#L108)

- Prefer heavy-animal + L/D mains before breakfast forms in keep set
  [`invent-recipes.ts:332`](../../src/domain/suggestions/invent-recipes.ts#L332)

- Retry invent when kept set still lacks heavy-animal main
  [`invent-recipes.ts:389`](../../src/domain/suggestions/invent-recipes.ts#L389)

**Create-flow assign**

- Fail create if assign pool has no heavy-animal main for L/D menus
  [`generate-menu.ts:251`](../../src/domain/suggestions/generate-menu.ts#L251)

- Post-variety guarantee: place meat on ≥1 L/D slot
  [`variety.ts:262`](../../src/domain/suggestions/variety.ts#L262)

- Skip empty L/D pools instead of assigning breakfast leftovers
  [`variety.ts:155`](../../src/domain/suggestions/variety.ts#L155)

**Regression mirror**

- Verifier cases for сырники / potato bake / meat placement / batch reuse
  [`verify-suggestions-logic.mjs:1788`](../../scripts/verify-suggestions-logic.mjs#L1788)
