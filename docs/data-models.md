# Data Models — keplo

**Source of truth:** `supabase/migrations/` (32 migrations).  
**Architectural pivot:** `20260720120000_drop_catalog_buyability.sql` removed live catalog tables.

## Active Tables

| Table | Purpose | Tenancy |
|-------|---------|---------|
| `user_settings` | Per-user settings shell (`available_equipment` default for create-menu) | `user_id = auth.uid()` |
| `recipes` | Shared recipe library (seed + AI invent) | Authenticated SELECT/INSERT/UPDATE |
| `critical_ingredients` | Ingredient lines (`critical`/`pantry`) + amounts/units | Authenticated; drives shopping |
| `menus` | User menu plans (`day_count`, `people_count`, `slot_edit_passed_at`) | Owner RLS |
| `menu_slots` | Day × meal: `recipe_id`, optional `companion_recipe_id`, `servings` | Via menu |
| `menu_snacks` | One snack per day: free-text `label` + optional price/KBJU | Via menu |
| `recipe_refusals` | Hard suppress | Owner |
| `recipe_ratings` | like / medium / dislike (+ reason) | Owner |
| `snack_ratings` | By normalized snack `label` | Owner |
| `taste_preferences` | `ban` / `wish` free-text for AI prompts | Owner |
| `shopping_lists` | 1:1 snapshot header per menu | Via menu |
| `shopping_list_lines` | Ingredient/snack lines + quantities | Via shopping list |

## Key Columns / Behaviors

- **UJ-1:** `menus.slot_edit_passed_at` — shopping list build requires non-null
- **Meals:** up to 6 slot types (`breakfast`, `second_breakfast`, `lunch`, `afternoon_snack`, `dinner`, `late_dinner`)
- **Companions:** `menu_slots.companion_recipe_id` for lunch / dinner / late_dinner
- **Equipment:** `user_settings.available_equipment` (profile default), `menus.available_equipment` (per-menu hard filter), `recipes.required_equipment` (non-empty; eligibility = required ⊆ menu available). Closed vocab: stove, oven, air_fryer, grill, multicooker, pressure_cooker, microwave.
- **Prices:** `price_cents_per_serving` in **kopecks**; AI invent converts rubles → kopecks
- **Nutrition:** per-serving KBJU fields on recipes and snacks when present

## RPC

`create_menu_skeleton(p_day_count, p_servings default 2, p_meals text[] default ['breakfast','lunch','dinner'], p_equipment text[] default ['stove','oven'])`  
Creates menu + empty slots; snapshots `available_equipment`. 3-arg overload delegates with default stove+oven.

## Dropped (do not reintroduce)

- `stores`, `products`, `catalog_sync_runs`, `checked_matches`
- `menus.store_id`, `user_settings.selected_store_id`
- Product-linked snack / shopping SKU columns

## Migration Themes (chronological)

1. Auth settings + (later dropped) store/catalog era  
2. Menus / slots / recipes / ingredients / matches  
3. Refusals, ratings, UJ-1, snacks, shopping snapshot  
4. **Drop catalog buyability** — ingredient-name shopping  
5. People count, amounts, per-day snacks, taste prefs, companions  
6. Price/nutrition + kopeck fixes  

## Domain Mapping

| Domain module | Primary tables |
|---------------|----------------|
| `menu` | `menus`, `menu_slots`, `menu_snacks` |
| `suggestions` | `recipes`, `critical_ingredients`, refusals/ratings (read) |
| `shopping` | `shopping_lists`, `shopping_list_lines` |
| `history` | menus + ratings + snacks |
| `settings` | `taste_preferences` |
| `matching` | none (fridge-keep helpers only) |
