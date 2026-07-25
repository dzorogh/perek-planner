-- Drop binary main+companion FK; menu_slot_dishes is source of truth.
-- menu_slots.recipe_id remains as optional primary (protein/main) shim.

alter table public.menu_slots
  drop constraint if exists menu_slots_companion_ne_main;

alter table public.menu_slots
  drop constraint if exists menu_slots_companion_requires_main;

alter table public.menu_slots
  drop constraint if exists menu_slots_companion_meal_allowed;

alter table public.menu_slots
  drop column if exists companion_recipe_id;
