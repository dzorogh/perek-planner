---
title: 'Fix protein+protein plate pairing'
type: 'bugfix'
created: '2026-07-20'
status: 'done'
baseline_commit: '2f89069015ad24f9416c49206ec28c062f24a0dc'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Lunch/dinner slots can pair two heavy animal proteins (e.g. chicken main + fish companion). The normalize safety net only rejects veg+veg, so AI `needs_companion` pairings and fallback picks can leave meat/fish together on one plate.

**Approach:** Add a code guard that rejects a second meat/fish dish when the main already has meat/fish; repick a carb/veg/sauce side when possible, otherwise clear the companion. Keep veg-main + protein-add-on pairing unchanged.

## Boundaries & Constraints

**Always:**
- Reject companion when both main and companion are heavy animal protein (meat or fish stems).
- For protein mains needing a companion, prefer non-heavy-animal sides (гарнир/соус); never fall back to a second meat/fish dish.
- Preserve existing veg/carb main → protein companion behavior (including fish/chicken add-ons).
- Keep mushroom sauce / `looksLikeCompanionOnly` companions valid with meat mains.
- Mirror the guard in `scripts/verify-suggestions-logic.mjs` (inline duplicate of domain helpers).
- Russian home-cooking judgment: egg/mushroom/legume/dairy companions with a meat/fish main are allowed (not heavy-animal second mains).

**Ask First:**
- Broadening invent/assign prompt rewrites beyond one clarifying line about never pairing two meat/fish dishes.
- Changing what counts as “heavy animal” beyond meat+fish stems (e.g. treating eggs as heavy).

**Never:**
- Rewrite invent pipeline quality / breakfast invent rules in this change.
- UI copy or schema changes.
- Soft-trust AI plateKind without the new heavy-animal safety net.
- Treat chicken + mushroom sauce as invalid.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| AI chicken + fish | dinner: main chicken, companion fish, `needs_companion`; puree also in pool | companion → puree (or other non-heavy side) | N/A |
| Only fish left as companion | dinner: chicken main, fish only other candidate, `needs_companion` | companion → null (main alone better than two proteins) | N/A |
| Chicken + mushroom sauce | dinner: chicken + «Грибной соус» | companion kept | N/A |
| Veg cutlets + fish | dinner: морковные котлеты + fish | companion kept (protein add-on) | N/A |
| Protein main, omitted companion | chicken `needs_companion`, pool has puree + fish | auto-fill → puree, not fish | N/A |
| Breakfast | breakfast slot with any companion | companion cleared (existing) | N/A |

</frozen-after-approval>

## Code Map

- `src/domain/suggestions/meal-fit.ts` -- add `looksLikeHeavyAnimalProteinDish` (meat/fish stems only; share stems with `looksLikeProteinDish`)
- `src/domain/suggestions/plate-complete.ts` -- reject heavy+heavy; pickCompanion prefers non-heavy when main already has protein; clear if no valid side
- `src/domain/suggestions/index.ts` -- export new helper if barrel already exports meal-fit helpers
- `src/domain/suggestions/openrouter-generate.ts` -- optional one-line assign prompt: never second meat/fish when main already has meat/fish
- `scripts/verify-suggestions-logic.mjs` -- mirror helper + matrix tests

## Tasks & Acceptance

**Execution:**
- [x] `src/domain/suggestions/meal-fit.ts` -- add `looksLikeHeavyAnimalProteinDish` using existing meat/fish stem lists -- distinguish heavy animal vs egg/mushroom/legume protein
- [x] `src/domain/suggestions/plate-complete.ts` -- after AI companion validation: if main is heavy animal and companion is heavy animal (and not companion-only sauce name), null it; when picking for protein/heavy main, exclude heavy-animal candidates; if none, leave companion null
- [x] `src/domain/suggestions/index.ts` -- export new helper consistently with existing meal-fit exports
- [x] `src/domain/suggestions/openrouter-generate.ts` -- add one HARD assign-prompt line forbidding meat/fish + meat/fish on one plate
- [x] `scripts/verify-suggestions-logic.mjs` -- mirror logic + cover I/O matrix cases (chicken+fish→puree; chicken+only-fish→null; sauce kept; veg+fish kept; auto-fill prefers puree)

**Acceptance Criteria:**
- Given a dinner assignment of chicken + fish with a carb companion in the candidate pool, when `normalizePlateAssignments` runs, then the companion is the carb side (not fish).
- Given chicken + only fish available as companion, when normalize runs, then companion is cleared.
- Given vegetable cutlets + fish, when normalize runs, then fish companion is kept.
- Given chicken + «Грибной соус», when normalize runs, then sauce companion is kept.
- Given `npm run verify:logic` (or the suggestions logic script), when run, then new checks PASS.

## Spec Change Log

## Design Notes

Heavy-animal = meat OR fish lexical stems already used in `looksLikeProteinDish`. Do **not** use the full `looksLikeProteinDish` for the second-protein reject — that would incorrectly block mushroom sauces and egg sides.

Golden examples:
- Forbidden: «Куриные грудки…» + «Запечённая рыба…»
- OK: «Куриные грудки…» + «Картофельное пюре»
- OK: «Морковные котлеты» + «Запечённая рыба…»
- OK: «Курица…» + «Грибной соус»

## Verification

**Commands:**
- `node scripts/verify-suggestions-logic.mjs` -- expected: all checks PASS, exit 0
- `npm run lint` -- expected: no new errors on touched files

## Suggested Review Order

**Normalize guard**

- Reject meat/fish + meat/fish; repick side or clear companion
  [`plate-complete.ts:151`](../../src/domain/suggestions/plate-complete.ts#L151)

- Autofill never falls back to a second heavy animal protein
  [`plate-complete.ts:250`](../../src/domain/suggestions/plate-complete.ts#L250)

**Heavy-animal detector**

- Meat/fish only; dairy cutlets and celery excluded
  [`meal-fit.ts:210`](../../src/domain/suggestions/meal-fit.ts#L210)

**Assign prompts**

- HARD rule in system + user instruction
  [`openrouter-generate.ts:68`](../../src/domain/suggestions/openrouter-generate.ts#L68)

**Tests**

- Chicken+fish → puree; only-fish → null; veg+fish kept
  [`verify-suggestions-logic.mjs:641`](../../scripts/verify-suggestions-logic.mjs#L641)
