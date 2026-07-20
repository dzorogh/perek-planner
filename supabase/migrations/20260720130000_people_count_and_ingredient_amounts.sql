-- People count at menu create; ingredient amounts for shopping list quantities.

-- 1) Ingredient amounts (per 1 serving / person)
alter table public.critical_ingredients
  add column if not exists amount_per_serving numeric null
    check (amount_per_serving is null or amount_per_serving > 0),
  add column if not exists unit text null
    check (unit is null or unit in ('g', 'ml', 'pcs', 'tsp', 'tbsp'));

comment on column public.critical_ingredients.amount_per_serving is
  'Amount needed per 1 person serving. Scaled by menu_slots.servings in shopping list.';
comment on column public.critical_ingredients.unit is
  'g | ml | pcs | tsp | tbsp. Null when amount unknown.';

-- Consistency: both set or both null
alter table public.critical_ingredients
  drop constraint if exists critical_ingredients_amount_unit_pair;
alter table public.critical_ingredients
  add constraint critical_ingredients_amount_unit_pair
  check (
    (amount_per_serving is null and unit is null)
    or (amount_per_serving is not null and unit is not null)
  );

-- 2) Shopping list line quantities (snapshot)
alter table public.shopping_list_lines
  add column if not exists quantity_amount numeric null
    check (quantity_amount is null or quantity_amount > 0),
  add column if not exists quantity_unit text null
    check (quantity_unit is null or quantity_unit in ('g', 'ml', 'pcs', 'tsp', 'tbsp'));

alter table public.shopping_list_lines
  drop constraint if exists shopping_list_lines_qty_unit_pair;
alter table public.shopping_list_lines
  add constraint shopping_list_lines_qty_unit_pair
  check (
    (quantity_amount is null and quantity_unit is null)
    or (quantity_amount is not null and quantity_unit is not null)
  );

-- 3) create_menu_skeleton accepts people count; stamps slot servings
drop function if exists public.create_menu_skeleton(integer);

create or replace function public.create_menu_skeleton(
  p_day_count integer,
  p_servings integer default 2
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_menu_id uuid;
  v_day integer;
  v_meal text;
  v_servings integer := coalesce(p_servings, 2);
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_day_count not in (1, 2, 3, 4) then
    raise exception 'invalid day_count';
  end if;

  if v_servings < 1 or v_servings > 20 then
    raise exception 'invalid servings';
  end if;

  insert into public.menus (user_id, day_count, default_servings_per_meal)
  values (v_user_id, p_day_count, v_servings)
  returning id into v_menu_id;

  for v_day in 1..p_day_count loop
    foreach v_meal in array array['breakfast', 'lunch', 'dinner']::text[] loop
      insert into public.menu_slots (menu_id, day_index, meal, recipe_id, servings)
      values (v_menu_id, v_day, v_meal, null, v_servings);
    end loop;
  end loop;

  return v_menu_id;
end;
$$;

comment on function public.create_menu_skeleton(integer, integer) is
  'Create Menu + empty slots; p_servings = people count applied to all slots.';

revoke all on function public.create_menu_skeleton(integer, integer) from public;
revoke all on function public.create_menu_skeleton(integer, integer) from anon;
grant execute on function public.create_menu_skeleton(integer, integer) to authenticated;

-- 4) Backfill sensible per-serving amounts for known seed/library names
update public.critical_ingredients set amount_per_serving = 40, unit = 'g'
  where unit is null and lower(name) in ('гречка', 'овсяные хлопья');
update public.critical_ingredients set amount_per_serving = 100, unit = 'g'
  where unit is null and lower(name) in ('шампиньоны', 'помидоры', 'капуста', 'морковь', 'лук');
update public.critical_ingredients set amount_per_serving = 150, unit = 'g'
  where unit is null and lower(name) in ('картофель');
update public.critical_ingredients set amount_per_serving = 200, unit = 'ml'
  where unit is null and lower(name) in ('молоко');
update public.critical_ingredients set amount_per_serving = 2, unit = 'pcs'
  where unit is null and lower(name) in ('яйца');
update public.critical_ingredients set amount_per_serving = 10, unit = 'g'
  where unit is null and lower(name) in ('зелень', 'сыр');
update public.critical_ingredients set amount_per_serving = 120, unit = 'g'
  where unit is null and lower(name) in ('курица', 'мясо');
update public.critical_ingredients set amount_per_serving = 2, unit = 'g'
  where unit is null and lower(name) in ('соль');
update public.critical_ingredients set amount_per_serving = 10, unit = 'ml'
  where unit is null and lower(name) in ('масло', 'масло растительное');
