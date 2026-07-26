-- Menu sheet redesign: breakfast fruit role (Harvard Fruits).

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
      'fruit',
      'snack'
    )
  );

alter table public.recipes
  drop constraint if exists recipes_covers_roles_check;

alter table public.recipes
  add constraint recipes_covers_roles_check
  check (
    covers_roles is null
    or covers_roles <@ array[
      'main',
      'soup',
      'protein',
      'veg',
      'carb',
      'fruit',
      'snack'
    ]::text[]
  );

alter table public.menu_slot_dishes
  drop constraint if exists menu_slot_dishes_plate_role_check;

alter table public.menu_slot_dishes
  add constraint menu_slot_dishes_plate_role_check
  check (
    plate_role in (
      'main',
      'soup',
      'protein',
      'veg',
      'carb',
      'fruit',
      'snack'
    )
  );

comment on column public.recipes.plate_role is
  'Primary plate role (main|soup|protein|veg|carb|fruit|snack; legacy companion retained).';
