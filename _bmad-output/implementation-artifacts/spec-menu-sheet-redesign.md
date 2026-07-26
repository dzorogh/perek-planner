---
title: 'Menu sheet redesign (v5)'
type: 'feature'
created: '2026-07-26'
status: 'done'
baseline_commit: '2347fc6'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/.working/key-menu-redesign-v5-sheet-2026-07-26.html'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/.memlog.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Menu page feels fragmented: editable equipment after create, duplicate day cards, unclear price/kcal, gated shopping list, wrong plate labels, and a useless dish list.

**Approach:** Ship the approved v5 “menu sheet” composition — two (or more) day-pair sheets, Harvard role naming + breakfast fruit, read-only settings chips, portion-clear metrics, ungated Список, updated totals — matching the locked UX memlog decisions.

## Boundaries & Constraints

**Always:**
- Soft Workshop / Lavender Workshop tokens; Russian UI; desktop.
- Menus are always day-pairs (`MENU_DAY_PAIRS`); sheet = one pair.
- Settings after create are read-only chips (days, people, meals, equipment).
- Dish ⋯ keeps Заменить · Изменить · Не предлагать (refusal label shortened).
- Meta on dish rows: `N порции · price ₽ · kcal` (plain); N = day-occurrences × people for that dish on the sheet (pair × servings).
- Totals: `price · kcal · Белки X г · Жиры Y г · Углеводы Z г за меню` + `~W ккал / чел. / день`.
- Visual span by sheet (no «Дни N–M» on rows); full-height sheets (no max-height clamp / no sticky masthead — renegotiated in review); equal sheet heights via grid stretch.
- Список wizard step always clickable when `menuId` present (no UJ-1 soft-gate / no bottom CTA).
- Do not narrate cut features in UI copy.

**Ask First:**
- Changing create-menu meal templates beyond adding breakfast `fruit`.
- Reintroducing per-day column grid as primary Menu layout.

**Never:**
- Editable equipment strip on Menu.
- «Блюда в меню» block; bottom «К списку» CTA.
- «Заменить все»; Oils/Water slots; v4 plate diagram composition.
- Superpowers paths/docs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path 4-day menu | Generated menu, 2 sheets | Two equal-height sheets; roles colored; fruit on breakfast; totals D format | N/A |
| Open Список | menuId, slot_edit not passed | Pill «Список» navigates; shopping page loads | If load fails, existing error UI |
| Replace dish | ⋯ → Заменить on sheet row | Pair both days update (existing domain) | Busy overlay / fail RU |
| Refusal copy | ⋯ menu | Label «Не предлагать» | N/A |
| Missing fruit on old menu | Breakfast slots without fruit dish | Empty fruit row OK (placeholder / empty role line) | No crash |

</frozen-after-approval>

## Code Map

- `app/(authenticated)/plan/menu/page.tsx` -- compose chips + sheets + totals; drop equipment editor / dish list / CTA
- `src/components/menu/menu-sheet-grid.tsx` -- pair sheets (replaces day-card-grid)
- `src/components/menu/menu-settings-chips.tsx` -- read-only chips
- `src/components/menu/slot-dish-line.tsx` -- role rail colors + portion meta
- `src/components/menu/slot-card-actions.tsx` -- refusal label «Не предлагать»
- `src/components/recipes/recipe-value-line.tsx` -- `MenuTotalsBar` format D
- `src/domain/recipes/scale-totals.ts` -- helpers for portion line + per-capita kcal
- `src/domain/menu/plate-role-labels.ts` -- Harvard RU labels (Завтрак, Полезный белок, Цельные злаки, Фрукты)
- `src/domain/menu/meal-templates.ts` -- breakfast `["main","fruit"]`; add `fruit` to `PLATE_ROLES`
- `supabase/migrations/*_plate_role_fruit.sql` -- allow `fruit` in checks + apply via MCP
- AI invent/generate paths that list plate roles -- include fruit for breakfast
- `src/components/layout/pill-nav.tsx` + shopping-list page -- ungated Список
- `e2e/planning-flow.spec.ts` -- update selectors/copy for refusal + list gate
- Visual SoT: `_bmad-output/planning-artifacts/ux-designs/ux-keplo-2026-07-19/.working/key-menu-redesign-v5-sheet-2026-07-26.html`

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/` + MCP apply -- add `fruit` to `plate_role` / `covers_roles` checks
- [x] `src/domain/menu/meal-templates.ts` + invent/generate role lists -- breakfast includes fruit
- [x] `src/domain/menu/plate-role-labels.ts` -- RU Harvard labels
- [x] `src/domain/recipes/scale-totals.ts` + value-line components -- portion meta + totals D
- [x] New `src/components/menu/menu-sheet-grid.tsx` (or rewrite day-card-grid) -- pair sheets UI
- [x] `app/(authenticated)/plan/menu/page.tsx` -- chips header; wire sheets; remove equipment editor, MenuDishList, Continue CTA
- [x] `slot-card-actions.tsx` (+ snack if needed) -- «Не предлагать»
- [x] `pill-nav.tsx` + shopping-list gate -- Список always available with menuId
- [x] Logic/e2e verifiers -- update for fruit role, refusal label, ungated list

**Acceptance Criteria:**
- Given an open Menu, when the page loads, then settings appear as read-only chips and equipment is not editable.
- Given a 4-day menu, when viewing Состав, then two day-pair sheets show one dish row per role per sheet (no twin day cards); sheets grow with page scroll.
- Given a dish on a pair for 2 people, when meta renders, then it shows `4 порции · {unit} ₽ · {unit} ккал`.
- Given breakfast template, when roles render, then Завтрак + Фрукты appear; lunch/dinner use Суп (lunch) + Полезный белок + Овощи + Цельные злаки.
- Given ⋯ on a filled dish, when opened, then items are Заменить · Изменить · Не предлагать.
- Given Menu with menuId, when clicking Список in wizard, then shopping list opens without requiring bottom CTA.
- Given menu totals, when shown, then format matches approved D (combined за меню line + per-capita kcal).
- Given the page, when scanned, then «Блюда в меню» and «К списку покупок» are absent.

## Spec Change Log

- 2026-07-26 review: human removed sheet max-height + sticky masthead; chips use `bg-surface`; patches from adversarial review (locale totals D, portion meta without ₽/ккал, meal-aware `main` label, dayB slot fallback, dead UJ-1 CTA / day-card UI removed, sheet ⋯ without «Убрать»).

## Design Notes

Sheet = `menuDayPairsForCount(dayCount)` columns. Prefer day A of each pair for role dishes, fall back to day B if A missing (pair sync still domain-owned). Role accent colors: fruit `#E11D48`, veg `#16A34A`, protein `#EA580C`, grain `#A16207`, soup `#64748B`, breakfast/snack indigo.

Unit price/kcal on a sheet row = per-serving values; N = assigned pair-days × people. If a role is empty on the display day, show empty role affordance consistent with current empty-slot behavior. Sheets grow with content (page scroll).

## Verification

**Commands:**
- `npm run verify:logic` -- expected: PASS (incl. updated role/template tests if present)
- `npm run lint` -- expected: no new errors on touched files
- Manual: open `/plan/menu?menuId=…` — sheets, chips, totals, Список, ⋯ copy

**Manual checks:**
- Compare to v5 mock structure; no «Дни N–M» on rows; no inner sheet scroll clamp.

## Suggested Review Order

**Entry — Menu page composition**

- Chips + pair sheets + totals D; no equipment editor / dish list / CTA
  [`page.tsx:20`](../../app/(authenticated)/plan/menu/page.tsx#L20)

**Sheet UI**

- Day-pair sheets; dayA/dayB fallback; portionCount × assigned days
  [`menu-sheet-grid.tsx:131`](../../src/components/menu/menu-sheet-grid.tsx#L131)

- Read-only settings chips on `bg-surface`
  [`menu-settings-chips.tsx:21`](../../src/components/menu/menu-settings-chips.tsx#L21)

- Sheet rows: role rail, portion meta, meal-scoped labels
  [`slot-dish-line.tsx:14`](../../src/components/menu/slot-dish-line.tsx#L14)

**Domain / copy**

- Breakfast `main`+`fruit`; Harvard RU labels; `main`≠Завтрак off breakfast
  [`meal-templates.ts:32`](../../src/domain/menu/meal-templates.ts#L32)
  [`plate-role-labels.ts:24`](../../src/domain/menu/plate-role-labels.ts#L24)

- Portion line + totals D (ru-RU thousands, «за меню», per-capita)
  [`scale-totals.ts:250`](../../src/domain/recipes/scale-totals.ts#L250)
  [`scale-totals.ts:285`](../../src/domain/recipes/scale-totals.ts#L285)

**Ungated Список**

- Wizard step always links when `menuId` present
  [`pill-nav.tsx:17`](../../src/components/layout/pill-nav.tsx#L17)

**Schema**

- `fruit` allowed in plate_role / covers_roles checks
  [`20260726150000_plate_role_fruit.sql:1`](../../supabase/migrations/20260726150000_plate_role_fruit.sql#L1)

**Peripherals**

- Refusal copy «Не предлагать»; e2e sheets + Список via pill
  [`slot-card-actions.tsx`](../../src/components/menu/slot-card-actions.tsx)
  [`planning-flow.spec.ts`](../../e2e/planning-flow.spec.ts)
