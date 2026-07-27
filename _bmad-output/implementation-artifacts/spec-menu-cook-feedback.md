---
title: 'Menu cook feedback: prepared + like/dislike'
type: 'feature'
created: '2026-07-28'
status: 'done'
baseline_commit: 'ba26da7d8c60b047861635f6f4844cf1f0ee90b9'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After cooking, the operator cannot mark a menu dish as prepared or leave a quick like/dislike; the model still splits “slot dishes” vs snacks, and ratings still steer future AI suggestions.

**Approach:** Treat every line on the menu as one universal **Menu dish** entity (no “slot” in domain naming). Add prepared + like/dislike on that entity, show calm cues, lock planning mutations when set, persist on this menu only, and stop using ratings for future menu generation.

## Boundaries & Constraints

**Always:**
- One entity: **Menu dish** — covers cookable recipes and no-cook snacks. Universal names in domain/API/UI types (`MenuDish`, `menu_dishes`, actions keyed by dish id). Never introduce cook-feedback APIs named around slots or parallel snack-only feedback types.
- Persist `prepared` (bool) + `rating` (`like` | `dislike` | null) on that single entity table for this menu. Toggle prepared; set/clear rating on the dish. Do not store cook feedback on meal grouping rows (`menu_slots` or successor).
- Unify storage: migrate away from dual `menu_slot_dishes` + `menu_snacks` for dish lines into one `menu_dishes` (or equivalent universal name); update loaders, actions, realtime, shopping source, and UI call sites; delete the old dual path (no shims).
- Overflow: separator, then cook-feedback items distinct from planning (Заменить / Изменить / Не предлагать / Убрать / Предложить).
- When a dish is prepared or rated: hide/disable Заменить / Изменить / Убрать. Refuse may remain.
- Always-visible cues on the dish row when prepared and/or rated (subtle Soft Workshop).
- Menu dish `prepared`/`rating` and History rating tables must not influence invent/assign/resuggest/snack suggest/rank/prompts. Keep `recipe_refusals` hard-suppress only.
- Russian copy; `data-component` on primary new widgets; server actions + `revalidatePath`; no browser DB writes.

**Ask First:**
- Renaming the day×meal **grouping** table (`menu_slots`) itself (default: leave grouping table; only dish entity is universalized in this change).
- Redesigning History rating UI (default: leave UI; stop AI use of those ratings; do not write menu cook feedback into History tables).
- Removing «Не предлагать» when prepared/rated (default: keep).

**Never:**
- Treat meal slot / snack as separate cook-feedback entities or keep dual dish/snack feedback columns/APIs.
- Store prepared/rating on the grouping row.
- Use prepared or any ratings in future-menu eligibility/ranking/prompts (including taste-ban from rating dislike).
- Require a reason dialog for menu thumbs.
- Narrate declined scope in UI; keep legacy dual tables or slot-named dish types after the migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mark prepared | Filled Menu dish, not prepared | `prepared=true`; cue; planning locked | Russian message; UI unchanged |
| Unmark prepared | Prepared, no rating | `prepared=false`; cue gone; unlocked | Same |
| Set like | Filled Menu dish | `rating=like`; cue; locked | Same |
| Set dislike | Filled Menu dish | `rating=dislike`; cue; locked | Same |
| Cancel rating | Has like/dislike | `rating=null`; unlock unless prepared | Same |
| Toggle like→dislike | `rating=like` | `rating=dislike`; cue updates | Same |
| AI after any rating | Any rating present | Ratings ignored for suppress/rank/prompt; refusals still suppress | Fail closed on refusal load |
| Empty dish | No content on row | No prepared/rating actions | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- create/rename to `menu_dishes` with `prepared` + `rating`; migrate from `menu_slot_dishes` + `menu_snacks`; drop old tables/paths
- `src/domain/menu/load-menu.ts` -- load `MenuDish` views with prepared/rating
- `src/domain/menu/cook-feedback-actions.ts` -- one action surface by dish id
- `src/domain/menu/**` + shopping source + realtime listeners -- point at `menu_dishes`
- `src/components/menu/{slot-card-actions,slot-dish-line,snack-slot-card,menu-sheet-grid}.tsx` -- shared cook-feedback UI on Menu dish rows; fold snack card into same pattern where practical
- `src/domain/suggestions/{suppress,candidates,rank,openrouter-generate,generate-snacks}.ts` + rating taste-ban -- stop reading ratings for future menus
- `scripts/verify-suggestions-logic.mjs` -- ratings unused for suppress; refusals still do
- `_bmad-output/project-context.md` + `docs/data-models.md` -- Menu dish entity; refusals-only hard-suppress

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/YYYYMMDDHHMMSS_menu_dishes_cook_feedback.sql` -- unify into `menu_dishes` (+ `prepared`, `rating`); migrate data from `menu_slot_dishes`/`menu_snacks`; RLS/realtime; apply via Supabase MCP
- [x] `src/domain/menu/**` (+ shopping/realtime call sites) -- `MenuDish` load/actions; delete dual snack/slot-dish paths for dish lines
- [x] `src/domain/menu/cook-feedback-actions.ts` -- toggle prepared / set-or-clear rating by dish id; `revalidatePath`
- [x] `src/domain/suggestions/**` + rating taste-ban -- stop using ratings for future menus; keep refusals
- [x] `src/components/menu/**` -- cook-feedback overflow + cues + gate planning; universal Menu dish naming in new types/props
- [x] `scripts/verify-suggestions-logic.mjs` (+ `npm run verify:logic`) -- ratings unused for suppress
- [x] `_bmad-output/project-context.md`, `docs/data-models.md` -- document Menu dish + cook feedback; refusals-only suppress

**Acceptance Criteria:**
- [x] Given a filled Menu dish (recipe or snack kind) on `/plan/{menuId}/menu`, when ⋯ opens, then cook-feedback actions target that dish id and sit below a separator apart from planning actions.
- [x] Given the dish is prepared or rated, when overflow opens, then Заменить / Изменить / Убрать are unavailable; cues show on the row without opening the menu.
- [x] Given like/dislike on the dish, when cancelled, then `rating` is null and planning unlocks unless `prepared` remains.
- [x] Given any rating, when AI invent/assign/resuggest runs, then ratings do not hard-suppress or re-rank; Refusal still does.
- [x] Given the migration, when inspecting schema/code, then dish lines live in one universally named entity (no parallel snack dish table for the same role; no new “slot dish” cook-feedback API).

## Design Notes

**Menu dish** = unit of cook feedback and menu content. Meal grouping (day×meal) is layout only — not rated.

Kinds (recipe vs no-cook snack) are attributes/variants of Menu dish, not separate product entities for feedback.

Overflow: planning → separator → «Приготовлено» → «Нравится» / «Не нравится» (re-select clears).

## Verification

**Commands:**
- `npm run verify:logic` -- PASS; suppress = refusals-only
- `npm run lint` -- no new errors on touched files
- Apply migration via Supabase MCP -- success

**Manual checks:**
- Menu page: prepared/like/dislike/cancel on both a recipe line and a snack line via the same control pattern; planning locks; cues visible; reload persists.

## Suggested Review Order

**Schema — Menu dish**

- Rename to `menu_dishes` + cook feedback columns; migrate snacks; drop old table.
  [`20260728010000_menu_dishes_cook_feedback.sql:4`](../../supabase/migrations/20260728010000_menu_dishes_cook_feedback.sql#L4)

**Cook feedback + planning lock**

- Shared overflow actions and row cues for any filled Menu dish.
  [`cook-feedback-menu.tsx:28`](../../src/components/menu/cook-feedback-menu.tsx#L28)

- Server toggle/rate on filled dishes only; clear on re-select.
  [`cook-feedback-actions.ts:65`](../../src/domain/menu/cook-feedback-actions.ts#L65)

- Reject replace/modify/clear when prepared or rated (refuse still allowed).
  [`planning-lock.ts:40`](../../src/domain/menu/planning-lock.ts#L40)

- Content upserts reset prepared/rating so refuse/replace never inherits stale feedback.
  [`menu-dishes.ts:58`](../../src/domain/menu/menu-dishes.ts#L58)

**AI — ratings unused**

- Hard-suppress is refusals-only; ratings no longer load into suggest paths.
  [`suppress.ts:12`](../../src/domain/suggestions/suppress.ts#L12)

**UI polish**

- Dropdown separator uses Soft Workshop `bg-border` (not text `muted`).
  [`dropdown-menu.tsx:166`](../../src/components/ui/dropdown-menu.tsx#L166)
