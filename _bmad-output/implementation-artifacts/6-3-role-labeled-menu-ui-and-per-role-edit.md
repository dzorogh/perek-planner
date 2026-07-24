---
baseline_commit: 6d7c2481bf997f4a1485aed43d063254198082f0
---

# Story 6.3: Role-labeled Menu UI and per-role edit

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator (Sergey),
I want each dish line to show its Plate role clearly and to replace one role without breaking the whole meal,
So that I always know what each dish is for.

## Acceptance Criteria

1. **Given** a filled lunch or dinner `slot-cell`  
   **When** the Menu meal-lane renders  
   **Then** each Slot dish appears as a `slot-dish-line` with Russian role label (Суп / Белок / Овощи / Углеводы) and dish name (UX-DR17)  
   **And** multi-role one-pots show coverage on the line (e.g. «Белок · Углеводы»)

2. **Given** breakfast or snack `slot-cell`  
   **When** the Menu renders  
   **Then** the same `slot-dish-line` chrome is used (labels Основное / Перекус) — not a separate widget class (PRD FR-28 / epics FR29, UX-DR17)

3. **Given** `slot-overflow` on a role line  
   **When** the operator chooses replace or Refusal  
   **Then** the action targets that Plate role / dish (FR6, FR8)  
   **And** UI copy does not narrate abandoned companion/гарнир scope

4. **Given** empty roles  
   **When** the cell renders  
   **Then** empty role lines remain valid (empty slots/roles allowed) and the operator can still proceed toward Shopping list per UJ-1

## Tasks / Subtasks

- [x] Plate role labels + line chrome (AC: #1, #2)
  - [x] Add `src/domain/menu/plate-role-labels.ts` — RU map (`soup`→Суп, `protein`→Белок, `veg`→Овощи, `carb`→Углеводы, `main`→Основное, `snack`→Перекус) + `formatRoleCoverage(roles)` → «Белок · Углеводы»
  - [x] Add `src/components/menu/slot-dish-line.tsx` — quiet role caption + dish name (or empty placeholder); `data-component="slot-dish-line"`; name opens `RecipeTextPanel` when filled
  - [x] Load `recipes.covers_roles` into `MenuSlotDishView` (or derive coverage for the line) so one-pots can show multi-role label
- [x] Render cells from template + `dishes[]` (AC: #1, #2, #4)
  - [x] Rewrite `day-card-grid.tsx` `SlotCell`: iterate `rolesForMeal(meal)` (or filled dishes sorted by template order); one `slot-dish-line` per role; empty roles show placeholder; stop drawing only legacy main+companion
  - [x] Align snack / Перекус lane with same `slot-dish-line` chrome (`snack-slot-card.tsx` or fold into shared cell) — label Перекус; Полдник (`afternoon_snack`) uses Основное
  - [x] Do **not** invent a second widget class for breakfast/snack
- [x] Per-role overflow (AC: #3)
  - [x] Change UI `SlotDishTarget` / overflow props to `PlateRole` (keep thin legacy map only inside domain if needed)
  - [x] Fix `slot-actions.ts` `parseTarget` — accept PlateRole; stop collapsing everything to `main|companion`
  - [x] Wire replace / replace-all / refuse / invent-empty to the **line’s** role; resolve recipe id from `dishes[]` for that role (not only `recipe_id` / `companion_recipe_id` FKs)
  - [x] Remove user-facing «гарнир» / «компаньон» / «Добавить гарнир» actions and copy (use role language; empty carb line → «Предложить» like other empty roles)
  - [x] Keep overflow behind ⋯; no always-visible CTA row; Esc closes menu (existing patterns)
- [x] Aggregates still see all roles (AC: #1)
  - [x] Update `dish-summary.ts` / day-menu totals / `batch-scale` consumers that still read only main+companion so soup/veg appear in «Блюда в меню» and value sums when present
- [x] Explicit out of scope
  - [x] Do **not** re-migrate schema / redefine `MEAL_TEMPLATES`
  - [x] Do **not** add History pick / library browse for replace (AI resuggest only)
  - [x] Do **not** block UJ-1 continue on empty roles
  - [x] Do **not** narrate abandoned companion/гарнир scope in UI
- [x] Gate: lint/tsc/build as touched; add/adjust verify only if pure helpers (labels/coverage) need logic checks

## Dev Notes

### Epic context

Epic 6 = Harvard plate + uniform Slot dishes.  
**6.1 done:** schema, templates, `dishes[]` readers, dual-write.  
**6.2 done:** invent/assign into code-emitted roles + `covers_roles`.  
**6.3 this story:** Menu UI shows role lines and edits per role.

### Critical: Полдник ≠ Перекус

| Concept | Meal key | Template | UI role label |
| --- | --- | --- | --- |
| **Полдник** | `afternoon_snack` | `[main]` | Основное |
| **Перекус** | `snack` | `[snack]` | Перекус |

### Canonical RU labels (UX-DR17)

| PlateRole | Label |
| --- | --- |
| `soup` | Суп |
| `protein` | Белок |
| `veg` | Овощи |
| `carb` | Углеводы |
| `main` | Основное |
| `snack` | Перекус |

Multi-role coverage: join with ` · ` (e.g. «Белок · Углеводы»).  
Overflow actions: «Заменить» · «Заменить все» · «Никогда не предлагать» (+ existing «Изменить» / wish flow if already on the line — keep role-scoped).

### Current UI state (must change)

| Today | 6.3 target |
| --- | --- |
| `day-card-grid` draws main + optional companion from FKs | Ordered lines from `rolesForMeal` + `dishes[]` |
| `data-target=main\|companion` | `data-plate-role` / target = `PlateRole` |
| `parseTarget` → binary main\|companion | Accept `soup\|protein\|veg\|carb\|main\|snack` |
| «Добавить гарнир» | Empty role line «Предложить» (no гарнир copy) |
| Empty = only `!recipeId` | Empty **role** lines for missing template roles |
| `SnackSlotCard` separate chrome | Same `slot-dish-line` language |
| Totals / dish-summary ignore soup/veg | Include all dish recipe ids |

### Domain already ready (reuse)

- `MenuSlotView.dishes: MenuSlotDishView[]` — `load-menu.ts`
- `MEAL_TEMPLATES` / `rolesForMeal` / `PlateRole` — `meal-templates.ts`
- Resuggest domain `SlotDishTarget` already allows `PlateRole` — UI/parser lag
- UJ-1 continue does **not** require filled roles — keep that

### Previous story intelligence

- 6.2 kept legacy FK shim for pre-6.3 UI — this story can stop **rendering** from FKs; writers may still dual-write.
- 6.2 review: resuggest merges existing dishes so per-role replace does not wipe soup/veg — UI must pass the correct role so domain replaces the right dish.
- Working tree may still have 6.1/6.2 uncommitted on `baseline_commit` — implement on top; do not revert.

### Anti-patterns (do not)

- Render only `recipeId` + companion and claim Harvard complete
- Collapse PlateRole targets back to main/companion in `parseTarget`
- Ship «гарнир» / «компаньон» / «без гарнира» user-facing copy
- Separate breakfast/snack widget class
- Always-visible multi-button row on each cell
- History/library pick for replace
- Confuse Полдник / Перекус labels
- Block Shopping continue because a role is empty

### Project context reference

- Soft workshop chrome: `bg-empty-slot`, `text-slot-label`, surface/border tokens
- Overflow: shadcn DropdownMenu behind ⋯; one open at a time
- Result unions + Russian errors at action edge
- No OpenRouter from Client Components

### Testing requirements

- Manual: lunch shows 4 role lines (empty or filled); dinner 3 without soup; breakfast/Полдник Основное; Перекус Перекус
- Manual: replace on Овощи does not clear Суп; one-pot line shows «Белок · Углеводы»
- Manual: empty role → Предложить; continue to shopping still works
- Optional: pure verify for `formatRoleCoverage` / label map if extracted

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 6 / Story 6.3]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/EXPERIENCE.md` — slot-dish-line / slot-overflow]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/DESIGN.md` — UX-DR17 visuals]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR-28, FR-6, FR-8]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-25.md`]
- [Source: `_bmad-output/implementation-artifacts/6-2-template-driven-ai-invent-assign.md`]
- [Source: `src/components/menu/day-card-grid.tsx`, `slot-card-actions.tsx`, `snack-slot-card.tsx`]
- [Source: `src/domain/menu/load-menu.ts`, `meal-templates.ts`, `slot-actions.ts`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

### Completion Notes List

- Menu cells render ordered `slot-dish-line`s from `rolesForMeal` + `dishes[]`; one-pot covered roles collapse into a multi-role caption («Белок · Углеводы»).
- Overflow `target` is `PlateRole`; empty lines use «Предложить»; no user-facing гарнир/компаньон copy in `src/components/menu`.
- Snack lane reuses `SlotDishLine` (`plateRole=snack`); Полдник stays `main` / «Основное».
- `dish-summary` / `scale-totals` / `batch-scale` include all dish recipe ids when `dishes[]` present.
- Gates: `verify:logic` (incl. `verify-plate-role-labels-logic`), `tsc`, eslint on touched paths, `npm run build` — pass.

### File List

- `src/domain/menu/plate-role-labels.ts` (new)
- `src/components/menu/slot-dish-line.tsx` (new)
- `src/components/menu/day-card-grid.tsx`
- `src/components/menu/snack-slot-card.tsx`
- `src/components/menu/slot-card-actions.tsx`
- `src/domain/menu/load-menu.ts`
- `src/domain/menu/slot-actions.ts`
- `src/domain/menu/dish-summary.ts`
- `src/domain/suggestions/resuggest-slot.ts` (review patches)
- `src/domain/recipes/batch-scale.ts`
- `src/domain/recipes/scale-totals.ts`
- `scripts/verify-plate-role-labels-logic.mjs` (new)
- `package.json`

### Change Log

- 2026-07-25: Role-labeled Menu UI + per-role overflow; status → review.
- 2026-07-25: Code review — findings recorded below.
- 2026-07-25: Applied 7 review patches; status → done.

### Review Findings

- [x] [Review][Patch] Resolve overflow recipe from dishes / treat `carb` like companion — `resolveRecipeIdForTarget` + dish-aware `collectPairReplaceJobs` [`src/domain/suggestions/resuggest-slot.ts`]
- [x] [Review][Patch] Empty-role «Предложить» invents by PlateRole — `resuggestRoleForPair` for soup/veg/… [`src/domain/suggestions/resuggest-slot.ts`]
- [x] [Review][Patch] `mergeSnacksByDay` keeps `menu_snacks.id` [`src/domain/menu/load-menu.ts`]
- [x] [Review][Patch] Restore `data-component="snack-slot"` wrapper [`src/components/menu/snack-slot-card.tsx`]
- [x] [Review][Patch] Skip covered empty role lines [`src/components/menu/day-card-grid.tsx`]
- [x] [Review][Patch] Fallback UI when `dishes[]` empty but legacy FKs filled [`src/components/menu/day-card-grid.tsx`]
- [x] [Review][Patch] Distinguish overflow `aria-label` per plate role [`src/components/menu/slot-card-actions.tsx`]
- [x] [Review][Defer] `canClear` only for carb — deferred, pre-existing MVP scope (story keeps clear on secondary carb only)
- [x] [Review][Defer] Verify script duplicates label helpers — deferred, pre-existing pure-script pattern in repo
- [x] [Review][Defer] Parallel empty-role «Предложить» lacks cell-level busy — deferred, pre-existing busy model keyed on `recipeId`
