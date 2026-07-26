-- Allow recipes with no equipment (raw salads / no-heat sides).
-- Empty required_equipment means "no appliances needed" and fits any menu.

alter table public.recipes
  drop constraint if exists recipes_required_equipment_check;

alter table public.recipes
  add constraint recipes_required_equipment_check
  check (
    cardinality(required_equipment) >= 0
    and required_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

comment on column public.recipes.required_equipment is
  'Equipment required to cook this recipe (⊆ menu.available_equipment). Empty = no appliances needed.';
