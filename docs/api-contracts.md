# API Contracts — keplo

keplo has **no HTTP Route Handlers** (`app/**/route.ts`). The “API” is **Next.js Server Actions** + RSC data loaders under `src/domain/`.

Auth: Supabase session cookies (`@supabase/ssr`). OpenRouter only from server modules.

## Server Actions

### Menu lifecycle

| Action | File | Behavior |
|--------|------|----------|
| `createMenuSkeletonAction` | `src/domain/menu/create-menu-actions.ts` | Validate day (2/4/6)/people/meals → `generateBuyableMenuForUser` → redirect to `/plan/menu`; form idempotency key; rollback deletes menu on AI failure |
| `resuggestSlotAction` | `src/domain/menu/slot-actions.ts` | Fill empty cookable slot (day-pair invent); UI: «Предложить» |
| `suggestCompanionAction` | same | Invent companion for main without one (day-pair); UI: «Добавить гарнир» |
| `resuggestRecipeAcrossMenuAction` | same | Replace dish in every menu slot where it appears; UI: «Заменить» |
| `modifyRecipeAcrossMenuAction` | same | Variant of current dish from user wish; applies to every matching slot; UI: «Изменить» |
| `refuseSlotAction` | same | Insert refusal + replace; may ban taste |
| `clearCompanionAction` | same | Clear `companion_recipe_id` |
| `continueToShoppingListAction` | same | Set `slot_edit_passed_at`, redirect to shopping list (`continueToPortionsAction` alias) |
| `updateSlotServingsAction` | `src/domain/menu/portion-actions.ts` | Update `menu_slots.servings` (1–20) |
| `getSlotEditPassedAction` | `src/domain/menu/uj1-actions.ts` | Read UJ-1 flag |

### Snacks

| Action | File | Behavior |
|--------|------|----------|
| `resuggestSnackAction` | `src/domain/menu/snack-actions.ts` | AI snack label (+ optional price/KBJU) |
| `refuseSnackAction` | same | Refuse + replace snack |
| `updateSnackLabelAction` | same | Manual label; clears AI estimates |
| `clearSnackAction` | same | Delete snack row |
| `suggestSnackForDayAction` | same | Ensure day snack + resuggest |

### History / settings

| Action | File | Behavior |
|--------|------|----------|
| `upsertRecipeRatingAction` | `src/domain/history/rating-actions.ts` | Upsert rating; dislike → taste ban |
| `upsertSnackRatingAction` | same | Snack rating by label |
| `deleteMenuAction` | `src/domain/history/delete-actions.ts` | Delete menu (cascade) |
| `addTastePreferenceAction` | `src/domain/settings/taste-preference-actions.ts` | Insert ban/wish |
| `deleteTastePreferenceAction` | same | Delete preference |
| `loadAiDebugLogAction` | `src/domain/settings/ai-debug-actions.ts` | Latest OpenRouter request/response pairs (process memory) |
| `clearAiDebugLogAction` | same | Clear AI debug ring buffer |

## RSC / non-action entry points

| Caller | Function | Notes |
|--------|----------|-------|
| Plan menu page | `loadMenuSkeleton` | Slots + recipes + snacks |
| Shopping page | `buildShoppingList(menuId)` | Requires UJ-1; regenerates snapshot |
| History page | `loadHistory` | Menus + ratings |
| Recipe dialog | `loadRecipeText` | Scaled body + ingredients |

## OpenRouter (internal)

| Function | File | Purpose |
|----------|------|---------|
| `openRouterChatCompletions` | `src/lib/openrouter/client.ts` | Low-level chat API |
| `proposeInventedRecipes` | `src/domain/suggestions/invent-recipes.ts` | Invent recipe JSON → persist |
| `proposeAssignmentsViaOpenRouter` | `src/domain/suggestions/openrouter-generate.ts` | Slot assign JSON (resuggest) |
| `proposeSnacksViaOpenRouter` | `src/domain/suggestions/generate-snacks.ts` | Snack JSON |
| `generateBuyableMenuForUser` | `src/domain/suggestions/generate-menu.ts` | Full create orchestration |

**Create-menu assign path:** invent via OpenRouter, then **deterministic** assignment (not LLM assign).  
**Resuggest path:** OpenRouter assign (+ optional invent).

## Error surface

- Domain: typed errors (e.g. `SuggestionError` with `reason`)
- Actions: `{ ok: false, error: string }` Russian messages or redirects
- OpenRouter: `OpenRouterError` / missing key → fail create or cookable paths
