# Component Inventory — keplo

**Root:** `src/components/`  
**Design system:** shadcn/ui (new-york) + Soft Workshop / light-only desktop  
**UI copy:** Russian

## Layout / chrome

| Component | Path | Notes |
|-----------|------|-------|
| `AppShell` | `layout/app-shell.tsx` | Header + max-width main |
| `AppHeader` | `layout/app-header.tsx` | Brand, Create Menu, nav, logout, plan wizard |
| `PrimaryNav` | `layout/primary-nav.tsx` | История, Настройки |
| `PillNav` | `layout/pill-nav.tsx` | Wizard: Состав → Список |
| `BrandMark` | `layout/brand-mark.tsx` | Logo |
| helpers | `layout/plan-chrome.ts` | Plan/wizard active href helpers |

## Menu

| Component | Path | `data-component` |
|-----------|------|------------------|
| `CreateMenuCta` | `menu/create-menu-cta.tsx` | — |
| `CreateMenuDialog` | `menu/create-menu-dialog.tsx` | `create-menu-dialog` |
| `CreateMenuForm` | `menu/create-menu-form.tsx` | — |
| `DayLengthPicker` | `menu/day-length-picker.tsx` | `day-length-picker` |
| `PeopleCountPicker` | `menu/people-count-picker.tsx` | `people-count-picker` |
| `MealTypesPicker` | `menu/meal-types-picker.tsx` | `meal-types-picker` |
| `DayCardGrid` | `menu/day-card-grid.tsx` | `meal-lane-grid`, `meal-lane`, `slot-cell`, `slot-dish` |
| `SnackSlotCard` | `menu/snack-slot-card.tsx` | `snack-slot` |
| `SlotCardActions` | `menu/slot-card-actions.tsx` | `slot-actions` |
| `MenuDishList` | `menu/menu-dish-list.tsx` | `menu-dish-list` |
| `ContinueToShoppingButton` | `menu/continue-to-shopping-button.tsx` | — |
| `PortionPlanGrid` | `menu/portion-plan-grid.tsx` | `portion-plan-grid` (**orphan** — route redirects) |

## History / recipes / shopping / settings / feedback

| Component | Path | `data-component` |
|-----------|------|------------------|
| `HistoryRatingRow` | `history/history-rating-row.tsx` | `history-rating-row` |
| `DeleteMenuButton` | `history/delete-menu-button.tsx` | — |
| `RecipeTextPanel` | `recipes/recipe-text-panel.tsx` | `recipe-text-trigger`, `recipe-text-panel` |
| `RecipeValueLine` / totals | `recipes/recipe-value-line.tsx` | `menu-totals` |
| `ShoppingListClient` | `shopping/shopping-list-view.tsx` | `shopping-list-cta` |
| `TastePreferencesPanel` | `settings/taste-preferences-panel.tsx` | `taste-preferences` |
| `CommentDialog` | `feedback/comment-dialog.tsx` | `comment-dialog` |

## Auth

| Component | Path |
|-----------|------|
| `LoginForm` | `login-form.tsx` |
| `LogoutButton` | `logout-button.tsx` |

## UI primitives (`ui/`)

`button`, `input`, `label`, `card`, `dialog`, `dropdown-menu`, `checkbox`, `badge` — Radix + CVA patterns.

## Patterns

- Server Components by default; `"use client"` for interactive widgets
- Prefer accessible roles + `data-component` for e2e
- Never advertise cut/deferred product scope in copy
