---
title: 'Available kitchen equipment for menu creation'
type: 'feature'
created: '2026-07-25'
status: 'review'
baseline_commit: '303d05c49d9c107d46190af758485dec91b2c258'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/docs/data-models.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-menu-available-equipment-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Menu generation ignores what kitchen appliances the operator actually has, so AI invent/assign can propose dishes that need unavailable equipment.

**Approach:** On create menu, the operator selects a closed set of kitchen equipment. That selection is a hard constraint for generation and every later AI path that proposes cookable recipes for that menu. Persist a profile default (`user_settings`) and a per-menu snapshot (`menus`); recipes carry `required_equipment`; eligibility is `required_equipment ⊆ menus.available_equipment` enforced in code (+ prompts).

## Boundaries & Constraints

**Always:**
- Hard constraint: recipes must be cookable with only selected equipment.
- Closed vocabulary (no free-text): `stove`, `oven`, `air_fryer`, `grill`, `multicooker`, `pressure_cooker`, `microwave`.
- Defaults: `stove` + `oven` pre-selected on first use; at least one type required; stove/oven are not privileged beyond default.
- Persist: upsert `user_settings.available_equipment` on create success / menu edit; snapshot `menus.available_equipment` at create; editable later on the menu screen.
- Scope: create + every AI path that proposes cookable recipes for that menu (invent, assign, resuggest, invent-for-position).
- On equipment edit: update menu snapshot + profile default; do **not** auto-rebuild existing dishes; new constraint applies to subsequent AI calls only.
- Enforcement: structured `required_equipment` on recipes + `buildCandidates` / invent parsers (+ prompt).
- No-cook snacks stay outside this filter.
- Apply migrations via Supabase MCP when adding SQL under `supabase/migrations/`.
- UI copy must not narrate abandoned/cut scope.

**Ask First:**
- Soft preference mode (non-hard filter).
- Dedicated settings-only kitchen page.
- Auto-rebuild of already assigned dishes when equipment shrinks.
- Open vocabulary / user-defined appliance names.

**Never:**
- Soft-trust prompt-only filtering without code eligibility checks.
- Filtering snacks by equipment in v1.
- HTTP route handlers or Client Components calling OpenRouter.
- Drive-by refactors unrelated to equipment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First create | No profile row | Picker defaults stove+oven | N/A |
| Create with custom set | ≥1 valid ids | Menu snapshot + profile upsert; invent/assign filtered | Invalid/empty → «Выберите хотя бы один вид техники.» / «Некорректный набор техники.» |
| Recipe requires oven only | Menu has stove+oven | Eligible | N/A |
| Recipe requires microwave | Menu has stove+oven | Ineligible for candidates/invent keep | Drop / retry invent if pool too small |
| Empty `required_equipment` | Invent draft or DB row | Ineligible for cookable assignment | Reject invent row |
| Edit equipment on menu | Shrink set | Snapshot + profile updated; existing slots unchanged | Later AI uses new set; clear RU error if pool empty (may hint expand equipment) |
| Profile upsert fails after menu write | Create path | Menu create still succeeds | Next form load falls back to last-known / default |
| Snack path | No-cook snacks | Unchanged; not via `required_equipment` | N/A |

## Equipment vocabulary (closed)

| id | UI label (RU) |
|----|-----------------|
| `stove` | Плита |
| `oven` | Духовка |
| `air_fryer` | Аэрогриль |
| `grill` | Гриль |
| `multicooker` | Мультиварка |
| `pressure_cooker` | Скороварка |
| `microwave` | Микроволновка |

## Data model

1. **`user_settings.available_equipment text[] not null`** — default `{stove, oven}`; upserted on confirm.
2. **`menus.available_equipment text[] not null`** — snapshot; SoT for AI + candidate filtering for that menu.
3. **`recipes.required_equipment text[] not null`** — non-empty for cookable recipes; AI invent must populate.

Invariants: vocabulary ids only, no duplicates; profile/menu length ≥ 1; eligibility `required_equipment ⊆ menus.available_equipment`.

**Backfill:** known stove-only seeds → `{stove}`; other existing cookable recipes → `{stove, oven}`.

## UI

**Create (`CreateMenuForm`):** block after meal types — «Какая техника есть»; chip picker; helper «Сгенерируем блюда только под выбранную технику»; cannot deselect last chip.

**Menu plan:** compact picker «Техника для этого меню»; persist menu + profile; no auto-regenerate.

</frozen-after-approval>

## Code Map

- `src/domain/menu/equipment.ts` — vocabulary, defaults, normalize/validate, subset check
- `scripts/verify-equipment-logic.mjs` — pure-logic mirror
- `supabase/migrations/20260725010000_available_equipment.sql` — columns, checks, backfill, `create_menu_skeleton` + `p_equipment`
- `src/domain/settings/available-equipment.ts` — load/upsert profile default
- `src/domain/menu/create-skeleton.ts` / `create-menu-actions.ts` — pass equipment on create
- `src/domain/menu/equipment-actions.ts` — update menu equipment from plan
- `src/domain/menu/load-menu.ts` — expose `availableEquipment`
- `src/components/menu/equipment-picker.tsx` / `create-menu-form.tsx` — create UI
- `src/components/menu/menu-equipment-editor.tsx` + `app/(authenticated)/plan/menu/page.tsx` — edit UI
- `src/domain/suggestions/candidates.ts` — filter by menu equipment
- `src/domain/suggestions/invent-recipes.ts` / `invent-for-position.ts` / `generate-menu.ts` / `resuggest-slot.ts` / `expand-menu-recipes.ts` — invent + thread equipment
- `docs/data-models.md` — document columns

## Tasks & Acceptance

**Execution:** Follow the detailed task plan:
`_bmad-output/implementation-artifacts/spec-menu-available-equipment-plan.md`
(via `bmad-dev-story` or `bmad-quick-dev` — not Superpowers).

High-level:
- [x] Domain helpers + `verify-equipment-logic` + wire `verify:logic`
- [x] Migration + apply via Supabase MCP
- [x] Settings load/upsert + skeleton create path
- [x] Equipment picker on create form
- [x] `buildCandidates` filter
- [x] Invent parse/persist `required_equipment` + prompt rules
- [x] Wire equipment through generate / resuggest / invent-for-position
- [x] Edit equipment on menu plan screen
- [x] Docs + full verify

## Dev Agent Record

### Completion Notes

- Implemented closed equipment vocabulary, profile + menu snapshot, recipe `required_equipment`, create/edit UI, and hard filters in candidates + invent/expand parsers.
- Migration `available_equipment` applied via Supabase MCP; 3-arg `create_menu_skeleton` wrapper kept.
- `npm run verify:logic` passes (includes equipment cases). Touched-file lint clean aside from pre-existing nested ternary on menu page.

### File List

- `src/domain/menu/equipment.ts`
- `scripts/verify-equipment-logic.mjs`
- `supabase/migrations/20260725010000_available_equipment.sql`
- `src/domain/settings/available-equipment.ts`
- `src/domain/settings/available-equipment-actions.ts`
- `src/domain/menu/create-skeleton.ts`
- `src/domain/menu/create-menu-actions.ts`
- `src/domain/menu/equipment-actions.ts`
- `src/domain/menu/load-menu.ts`
- `src/components/menu/equipment-picker.tsx`
- `src/components/menu/create-menu-form.tsx`
- `src/components/menu/menu-equipment-editor.tsx`
- `app/(authenticated)/plan/menu/page.tsx`
- `src/domain/suggestions/candidates.ts`
- `src/domain/suggestions/invent-recipes.ts`
- `src/domain/suggestions/expand-menu-recipes.ts`
- `src/domain/suggestions/invent-for-position.ts`
- `src/domain/suggestions/generate-menu.ts`
- `src/domain/suggestions/resuggest-slot.ts`
- `src/domain/suggestions/plan-menu-names.ts`
- `docs/data-models.md`
- `package.json`

### Change Log

- 2026-07-25: Feature implemented end-to-end per plan.

**Acceptance Criteria:**
- Given first-time create, when the form opens, then stove+oven are selected and at least one chip must remain.
- Given a custom equipment set on create, when create succeeds, then `menus.available_equipment` and `user_settings.available_equipment` match the selection.
- Given a recipe whose `required_equipment` is not ⊆ menu set, when candidates/invent run, then it is excluded.
- Given invent output missing/invalid `required_equipment`, when parsing, then the draft is dropped.
- Given equipment edit on the menu screen, when saved, then snapshot + profile update and existing slots are not auto-rebuilt.
- Given snacks, when equipment filter runs, then snacks are unaffected.

## Design Notes

Constraint strength is hard. Menu selection is an upper bound, not a quota (need not use every selected type). Prefer 3-arg SQL wrapper → 4-arg `create_menu_skeleton` if dropping the old overload risks PostgREST clients. Profile upsert failure must not fail menu create.

## Verification

**Commands:**
- `npm run verify:logic` — includes equipment cases
- `npm run lint` — clean on touched files

**Manual checks:**
- Create dialog chips; cannot clear last; invent only under selected set; edit on `/plan/menu` persists without regenerating slots.
