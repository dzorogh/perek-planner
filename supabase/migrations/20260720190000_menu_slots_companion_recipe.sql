-- Optional second dish (side / protein) on lunch, dinner, late_dinner slots.
-- Breakfast-family meals keep companion_recipe_id null (domain invariant).

alter table public.menu_slots
  add column if not exists companion_recipe_id uuid references public.recipes (id);

alter table public.menu_slots
  drop constraint if exists menu_slots_companion_ne_main;

alter table public.menu_slots
  add constraint menu_slots_companion_ne_main
  check (companion_recipe_id is null or companion_recipe_id <> recipe_id);

comment on column public.menu_slots.companion_recipe_id is
  'Optional companion recipe (гарнир or protein). Used for lunch/dinner/late_dinner when main is incomplete; null for complete one-pot mains and breakfast-family meals.';
