---
title: 'Position-pair menu planning'
type: 'feature'
created: '2026-07-20'
status: 'superseded-by-pair-day-picker'
baseline_commit: '383a47a82e5e8bed6bb582800675d46dfb5794fd'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiate">

## Intent

**Problem:** Batch invent + post-hoc assign mixes meals, mis-pairs mains/companions, and produces incoherent day grouping.

**Approach:** Always plan 4 days as fixed pairs (1–2, 3–4). Invent one dish per position via a dedicated AI call (meal × pair × main|companion). AI sets `plate_kind` for lunch/dinner mains; companion invent runs only when `needs_companion`. Breakfast and snacks use the same 2-day pair model.

## Boundaries & Constraints

**Always:**
- Create Menu day picker offers `2 | 4 | 6` only (hard 2-day cook pairs).
- Hard pairs: 2→[1,2]; 4→+[3,4]; 6→+[5,6] (same recipe id on both days of a pair for that meal/snack).
- Invent prompts are position-specific (not a mixed batch then redistribute).
- Lunch/dinner/late_dinner mains: AI returns `plate_kind` = `complete` | `needs_companion`; invent companion only when `needs_companion`.
- Breakfast-family: invent main only (no companion).
- Snacks: one label per pair, written to both days in the pair.
- Create-flow does not use pool-based companion auto-fill to invent sides the AI did not request.
- Fridge-keep ≥ menu `day_count` for invented dishes on create.

**Ask First:**
- Changing pair layout (e.g. 2–3).
- Requiring meat on every lunch/dinner position (vs soft prefer in prompt).

**Never:**
- Soft-trust invent without meal-fit guards for breakfast vs lunch/dinner forms.
- UI copy narrating abandoned day options (1/3).
- Odd-length create (1/3/5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create B/L/D + snacks, 4 days | meals breakfast,lunch,dinner; snacks on; day=4 | pairs 1–2 and 3–4; 2 snack labels | Fail + rollback menu on invent/assign failure |
| Create 6 days | day=6 | pairs 1–2, 3–4, 5–6; 3 snack labels | Fail + rollback |
| Create 2 days | day=2 | one pair 1–2; 1 snack label | Fail + rollback |
| Complete main | AI lunch main `plate_kind=complete` | No companion invent; slots have main only | N/A |
| Needs companion | AI dinner main `needs_companion` | Companion invent for that pair; both days get same companion | Fail if companion invent fails |
| Breakfast | breakfast selected | One main per pair; no companions | N/A |
| Day picker | Create form | Radios 2 / 4 / 6 дней | Reject other lengths server-side |

</frozen-after-approval>

## Code Map

- `src/domain/menu/constants.ts` -- CREATE_MENU_DAY_COUNTS 2/4/6, MENU_DAY_PAIRS, menuDayPairsForCount
- `src/components/menu/create-menu-form.tsx` -- DayLengthPicker 2/4/6
- `src/domain/menu/create-menu-actions.ts` -- validate dayCount
- `src/domain/suggestions/invent-for-position.ts` -- NEW position invent
- `src/domain/suggestions/generate-menu.ts` -- pair loop assign
- `src/domain/suggestions/generate-snacks.ts` -- pair snacks
- `src/domain/suggestions/invent-recipes.ts` -- export persist helper
- `e2e/planning-flow.spec.ts` -- drop day radio click
- `scripts/verify-*.mjs` -- day=4 / pair helpers

## Tasks & Acceptance

**Execution:**
- [x] Lock day_count=4; remove picker
- [x] Position invent module + generate-menu rewrite
- [x] Snack pairs
- [x] Verify + e2e smoke update

**Acceptance Criteria:**
- Given create menu, when submitted, then menu has exactly 4 days and no day picker in UI.
- Given lunch pair with AI `complete`, when filled, then both days share main and have no companion.
- Given dinner pair with AI `needs_companion`, when filled, then both days share main+companion from position invent.
- Given snacks on, when filled, then days 1–2 share one snack label and days 3–4 share another.

## Spec Change Log

- 2026-07-20: Restored day picker as pair lengths 2 / 4 / 6 (renegotiated from fixed-4).

## Verification

**Commands:**
- `npm run verify:logic`
- `npx eslint` on touched files
