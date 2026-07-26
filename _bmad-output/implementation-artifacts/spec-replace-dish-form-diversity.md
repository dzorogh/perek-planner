---
title: 'Replace dish form diversity'
type: 'bugfix'
created: '2026-07-26'
status: 'done'
route: 'one-shot'
baseline_commit: '4ca0225b42db3b9e21b335fbf29a45121fab2e34'
---

# Replace dish form diversity

## Intent

**Problem:** «Заменить» often invents a near-same dish (same culinary form with another filling), so the swap feels pointless.

**Approach:** Strengthen the replace name-plan prompt to require a form (and method) leap, and pass the rejected dish as `replacedDishes` so the model has a clear leap target.

## Suggested Review Order

**Replace prompt**

- Form/method leap rules + role-safe pass/fail examples for «Заменить».
  [`plan-menu-names.ts:75`](../../src/domain/suggestions/plan-menu-names.ts#L75)

- User payload carries `replacedDishes` and restates the leap in the instruction.
  [`plan-menu-names.ts:405`](../../src/domain/suggestions/plan-menu-names.ts#L405)

**Threading**

- Role-scoped recipe ids for the dish being replaced (FK shim only if dishes[] empty).
  [`resuggest-slot.ts:975`](../../src/domain/suggestions/resuggest-slot.ts#L975)

- Main / role / carb paths load those names into `replacedDishes` for invent.
  [`resuggest-slot.ts:752`](../../src/domain/suggestions/resuggest-slot.ts#L752)
