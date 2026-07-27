# Data Models — keplo

**Source of truth:** `supabase/migrations/`.  
**Architectural pivot:** `20260720120000_drop_catalog_buyability.sql` removed live catalog tables.

## Active Tables

| Table | Purpose | Tenancy |
|-------|---------|---------|
| `user_settings` | Per-user settings shell (`available_equipment` default for create-menu) | `user_id = auth.uid()` |
| `recipes` | Shared recipe library (seed + AI invent) | Authenticated SELECT/INSERT/UPDATE |
| `critical_ingredients` | Ingredient lines (`critical`/`pantry`) + amounts/units | Authenticated; drives shopping |
| `menus` | User menu plans (`day_count`, `slot_edit_passed_at`, equipment snapshot) | Owner RLS |
| `menu_slots` | Day × meal grouping (`servings`; optional legacy `recipe_id`) | Via menu |
| `menu_dishes` | Universal **Menu dish** lines: recipe XOR `snack_label`, plate role, cook feedback (`prepared`, `rating`), snack nutrition | Via slot → menu |
| `recipe_refusals` | Hard suppress for future AI | Owner |
| `recipe_ratings` | History `like`/`medium`/`dislike` (+ reason); **not** used for AI suppress/rank | Owner |
| `snack_ratings` | History by snack `label`; **not** used for AI suppress/rank | Owner |
| `taste_preferences` | `ban` / `wish` free-text for AI prompts | Owner |
| `shopping_lists` | 1:1 curated cart per menu (`curated_product_keys`) | Via menu |

## Menu dish

- One entity for cookable recipes and no-cook snacks (`menu_dishes`).
- Kind: `recipe_id` set XOR `snack_label` set (check constraint).
- Cook feedback on the dish row: `prepared boolean not null default false`, `rating text null` in (`like`,`dislike`).
- Meal grouping stays on `menu_slots` (day × meal); not rated.
- Snack nutrition/price columns live on the snack dish row (migrated from dropped `menu_snacks`).

## Key Columns / Behaviors

- **UJ-1:** `menus.slot_edit_passed_at` — shopping list build requires non-null
- **Meals:** breakfast, second_breakfast, lunch, afternoon_snack, dinner, late_dinner, snack
- **Equipment:** `user_settings.available_equipment`, `menus.available_equipment`, `recipes.required_equipment` (empty = no appliances)
- **Prices:** `price_cents_per_serving` in **kopecks**
- **AI hard-suppress:** `recipe_refusals` only

## RPC

`create_menu_skeleton(p_day_count, p_servings default 2, p_meals text[] default ['breakfast','lunch','dinner'], p_equipment text[] default ['stove','oven'])`  
Creates menu + empty slots; snapshots `available_equipment`.

## Dropped (do not reintroduce)

- `stores`, `products`, `catalog_sync_runs`, `checked_matches`
- `menus.store_id`, `user_settings.selected_store_id`
- `menu_snacks`, `menu_slot_dishes` (unified into `menu_dishes`)
- Product-linked snack / shopping SKU columns

## Domain Mapping

| Domain module | Primary tables |
|---------------|----------------|
| `menu` | `menus`, `menu_slots`, `menu_dishes` |
| `suggestions` | `recipes`, `critical_ingredients`, `recipe_refusals` (read) |
| `shopping` | `shopping_lists` (+ live SOURCE from menu dishes) |
| `history` | menus + dishes + History rating tables |
| `settings` | `taste_preferences` |
| `matching` | none (fridge-keep helpers only) |
