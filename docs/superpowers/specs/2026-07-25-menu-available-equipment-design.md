# Design: Available kitchen equipment for menu creation

**Date:** 2026-07-25  
**Status:** Approved for implementation planning  
**Product:** keplo / perek-planner

## Goal

When creating a menu, the operator selects which kitchen equipment they have. Generation and all later AI suggestions for that menu may only use recipes that fit within the selected set. The choice is remembered for the next create flow and is also stored as a per-menu snapshot that can be edited later.

## Decisions

| Topic | Choice |
|-------|--------|
| Constraint strength | Hard: recipes must be cookable with only selected equipment |
| Defaults | `stove` + `oven` pre-selected on first use |
| Minimum selection | At least one equipment type; stove/oven are not privileged |
| Persistence | Profile default (`user_settings`) + snapshot on `menus` |
| Scope of constraint | Create + every AI path that proposes cookable recipes for that menu |
| Edit after create | Allowed on the menu; updates menu snapshot and profile default |
| Existing dishes on edit | Not auto-rebuilt; new constraint applies to subsequent AI calls |
| Enforcement | Structured `required_equipment` on recipes + code filter (+ prompt) |

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

No free-text equipment in v1.

## Data model

### Columns

1. **`user_settings.available_equipment text[] not null`**
   - Default for new rows / first use: `{stove, oven}`
   - Upserted whenever the operator confirms a selection (create success or menu edit)

2. **`menus.available_equipment text[] not null`**
   - Snapshot copied at create from the form selection
   - Editable later from the menu screen
   - Source of truth for AI + candidate filtering for that menu

3. **`recipes.required_equipment text[] not null`**
   - Equipment without which the dish cannot be cooked
   - Non-empty for cookable recipes
   - AI invent must populate this field

### Constraints / invariants

- Arrays contain only vocabulary ids, no duplicates (DB check and/or app normalization).
- Profile and menu selections: length ≥ 1.
- Recipe eligibility for a menu:
  `required_equipment ⊆ menus.available_equipment`
- A recipe may require multiple types (e.g. stove + oven).
- Menu need not use every selected type — selection is an upper bound, not a quota.
- No-cook snacks stay outside this filter (existing snack path; not via `recipes.required_equipment`).

### Backfill

- Seed / existing recipes without explicit tagging get a conservative default so the library is not emptied:
  - Known stove-only seeds (e.g. омлет, тушёная курица с гречкой) → `{stove}` where obvious
  - All other existing cookable recipes → `{stove, oven}`
- New invents always write precise tags.

## UI

### Create menu (`CreateMenuForm`)

- New block after meal types: heading «Какая техника есть»
- Chip picker matching meal-types pattern
- Default chips: stove + oven on; others off (or loaded from `user_settings` when present)
- Helper: «Сгенерируем блюда только под выбранную технику»
- Cannot deselect the last remaining chip
- On successful create: write selection to `menus` and upsert `user_settings`

### Menu plan screen

- Compact same picker: «Техника для этого меню»
- Persist to `menus.available_equipment` and upsert profile default
- Do not narrate cut/abandoned product scope in copy
- Do not auto-regenerate existing slots when the set shrinks

### Out of UI scope

- Dedicated settings-only kitchen page
- Free-text custom appliances

## Generation & filtering

### Create flow

1. Validate equipment (≥1, vocabulary only).
2. Upsert `user_settings.available_equipment`.
3. Create menu with `menus.available_equipment` = selection.
4. Pass `availableEquipment` into invent / name-plan / assign prompts: hard limit to that set; JSON must include `required_equipment`.
5. Reject invent rows where `required_equipment` is empty, has unknown ids, or is not ⊆ available; retry invent when the kept pool is too small (same family of recovery as today).
6. `buildCandidates` filters with `required_equipment ⊆ menu.available_equipment`. Recipes that somehow lack a valid non-empty `required_equipment` are ineligible for cookable assignment.

### Slot replace / invent-for-position / other menu AI

- Load `menus.available_equipment` for that menu.
- Same prompt constraint, invent validation, and candidate filter.

### Edit equipment on menu

- Update menu (+ profile).
- Subsequent AI uses the new set.
- If generation then fails for lack of eligible recipes: clear RU error, optionally suggesting expanding equipment (operational guidance, not “feature absence” marketing).

## Errors

| Case | Message direction |
|------|-------------------|
| Zero equipment selected | «Выберите хотя бы один вид техники.» |
| Invalid ids | «Некорректный набор техники.» |
| Empty invent/candidate pool under constraint | Existing generation-fail family; may mention expanding equipment as a recovery hint |
| Profile upsert failure after menu snapshot written | Do not fail the menu create; next form load falls back to menu last-known / default |

## Testing

- Unit: subset eligibility (equal, strict subset, extra required id fails, empty required fails, unknown id fails).
- Unit: vocabulary normalize/validate and ≥1 rule.
- Integration / verify script: create with custom set writes `menus` + `user_settings`; `buildCandidates` excludes mismatched equipment.
- Invent parser: requires `required_equipment` and drops out-of-set drafts.

## Non-goals

- Soft preference mode
- Auto rebuild of already assigned dishes when equipment shrinks
- Filtering snacks by equipment
- Open vocabulary / user-defined appliance names
- Separate global settings page solely for equipment

## Implementation touchpoints (expected)

- Migration under `supabase/migrations/` (+ apply via Supabase MCP)
- Domain constants for vocabulary + validation
- `create-menu-form` / new picker component; create action + skeleton create path
- `user_settings` load/upsert helpers
- Menu load + update action for equipment edit UI on plan/menu
- `buildCandidates`, invent schemas/prompts, resuggest / invent-for-position paths
- Docs: `docs/data-models.md` if kept in sync by project practice
