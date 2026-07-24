-- Story 6.2: recipes.plate_role may be a Harvard / template PlateRole (not only main|companion).

alter table public.recipes
  drop constraint if exists recipes_plate_role_check;

alter table public.recipes
  add constraint recipes_plate_role_check
  check (
    plate_role is null
    or plate_role in (
      'main',
      'companion',
      'soup',
      'protein',
      'veg',
      'carb',
      'snack'
    )
  );

comment on column public.recipes.plate_role is
  'Primary plate role for invent/assign (main|soup|protein|veg|carb|snack; legacy companion retained).';
