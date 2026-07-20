---
title: 'Modify dish with user wishes'
type: 'feature'
created: '2026-07-20'
status: 'done'
baseline_commit: 'a6ac3a10c53ea437f13542bc5ff40dd01aeb019d'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/docs/api-contracts.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the plan menu, operators can only replace a dish with something different or refuse it forever. They cannot keep the dish’s culinary identity and tweak it (ingredients, technique, complexity) via a short wish.

**Approach:** Add **«Изменить»** next to **«Заменить»**. A dialog collects a wish; AI invents a **variant of the current dish** (name may shift lightly; recipe body follows the wish) and applies the new recipe to **every menu slot** where that dish appears (main or companion role matching the action target).

## Boundaries & Constraints

**Always:**
- Cookable slots only (main/companion via existing `SlotCardActions`); same day-pair assign pattern as replace.
- Wish required (3–500 chars, same feedback validators); processed immediately via OpenRouter; show generating overlay while pending.
- Variant pipeline must **not** put the source dish name into `avoidNames` (unlike replace). Source recipe name + body are prompt context.
- Skip or relax variety-audit rejection that would force a “clearly different form” for the modified position.
- On failure: leave slots unchanged; clean up any newly persisted recipes; Russian error at action edge.
- Build on current uncommitted overlay / resuggest work; do not revert it.

**Ask First:**
- Persisting the wish into Settings `taste_preferences` (default: one-shot only).
- Changing snack slots the same way.

**Never:**
- Hard-refuse / ban the old recipe.
- Narrate abandoned scope in UI copy.
- HTTP route handlers; Client Components calling OpenRouter.
- Drive-by refactors unrelated to modify.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path main | Filled main + wish ≥3 chars | New variant recipe; all slots with that main recipe_id updated (pair-consistent) | N/A |
| Happy path companion | Companion target + wish | Companion variant; main unchanged; all matching companion slots updated | N/A |
| Empty / short wish | `<3` chars | Dialog blocks submit; no AI call | Client validation |
| No OpenRouter key | Missing key | Action `{ ok: false }` Russian no_key message | Same as resuggest |
| AI/parse fail | Bad model output | Slots unchanged; invented rows deleted | `{ ok: false }` Russian message |
| Same dish on multiple pairs | Recipe on lunch 1–2 and dinner 3–4 | Each matching job modified independently via pair jobs | Abort remaining jobs on first failure after cleanup |

</frozen-after-approval>

## Code Map

- `src/components/menu/slot-card-actions.tsx` — add «Изменить», dialog, overlay label
- `src/components/feedback/comment-dialog.tsx` — optional `fieldLabel` / `hint` (defaults = refuse copy)
- `src/domain/menu/slot-actions.ts` — `modifyRecipeAcrossMenuAction`
- `src/domain/suggestions/resuggest-slot.ts` — `modifyRecipeAcrossMenu` + pair helpers
- `src/domain/suggestions/plan-menu-names.ts` — `proposePositionModifyPlan`
- `src/domain/suggestions/expand-menu-recipes.ts` — wish + optional source body in expand prompt
- `src/domain/history/constants.ts` — wish length validators
- `docs/api-contracts.md` — document action

## Tasks & Acceptance

**Execution:**
- [x] `plan-menu-names.ts` -- `proposePositionModifyPlan` (source + wish; near-identity OK; avoid other menu names only)
- [x] `expand-menu-recipes.ts` -- Pass `modificationWish` (+ source body) when provided
- [x] `resuggest-slot.ts` -- `modifyRecipeAcrossMenu`: jobs → modify name→expand→assign; skip harsh variety for source; suppress old id; cleanup on fail
- [x] `slot-actions.ts` -- Action with comment validation, lock, revalidate
- [x] `comment-dialog.tsx` -- Optional fieldLabel/hint props
- [x] `slot-card-actions.tsx` -- «Изменить» + dialog + «Изменяем…» overlay
- [x] `docs/api-contracts.md` -- Document action
- [x] `scripts/verify-suggestions-logic.mjs` -- No new pure helpers extracted; existing verify:logic still PASS

**Acceptance Criteria:**
- Given a filled cookable dish, when actions open, then **«Изменить»** is next to **«Заменить»**.
- Given a valid wish and AI success, then every slot with that recipe id (chosen role) shows the variant.
- Given AI failure, then the previous dish remains and an error is shown.
- Given companion modify success, then the main dish is unchanged.
- Given snack cards, then no modify action appears.

## Spec Change Log

- review_loop 1 / patch: invent once per meal×role and reuse recipe ids across pairs; guard pair slots match source id before assign. Avoids divergent variants for the same source dish. KEEP: source not in avoidNames; skip variety audit; CommentDialog fieldLabel/hint; one-shot wish.

## Design Notes

```
Replace: current name in avoidNames → clearly different form
Modify: sourceDish={name,body}+userWish → VARIANT; source NOT in avoidNames;
        still avoid other keepDishes; skip “different form” audit for this position
Invent once per meal×role group → same recipe ids applied to every matching pair
```

UI: «Изменить блюдо» / submit «Изменить» / placeholder «Без грибов, попроще шаги». Wish is one-shot (not Settings) unless Ask First is renegotiated.

## Verification

**Commands:**
- `npm run lint` -- no new errors in touched files
- `npm run verify:logic` -- PASS including any new helpers

**Manual checks:**
- Изменить on a repeated dish updates pair days; companion-only leaves main; overlay during wait; refuse/replace unchanged.

## Suggested Review Order

**UI entry**

- Dropdown «Изменить» + wish dialog + overlay label
  [`slot-card-actions.tsx:136`](../../src/components/menu/slot-card-actions.tsx#L136)

- Optional fieldLabel/hint/pendingLabel for wish copy
  [`comment-dialog.tsx:17`](../../src/components/feedback/comment-dialog.tsx#L17)

**Server action**

- Form → lock → modifyRecipeAcrossMenu
  [`slot-actions.ts:97`](../../src/domain/menu/slot-actions.ts#L97)

**Domain pipeline**

- Public entry: validate wish, load source, apply across menu
  [`resuggest-slot.ts:866`](../../src/domain/suggestions/resuggest-slot.ts#L866)

- Variant name prompt (source allowed in avoidNames filter)
  [`plan-menu-names.ts:211`](../../src/domain/suggestions/plan-menu-names.ts#L211)

- Expand honors modificationWish + source body
  [`expand-menu-recipes.ts:66`](../../src/domain/suggestions/expand-menu-recipes.ts#L66)

**Contracts**

- Documented action row
  [`api-contracts.md:16`](../../docs/api-contracts.md#L16)
