-- Allow create-menu lengths 2 / 4 / 6 (hard cook pairs). Keep 1 and 3 for legacy rows.

alter table public.menus
  drop constraint if exists menus_day_count_check;

alter table public.menus
  add constraint menus_day_count_check
  check (day_count in (1, 2, 3, 4, 5, 6));

comment on column public.menus.day_count is
  'Menu length. Create flow uses 2, 4, or 6 (pair batches). Legacy rows may be 1 or 3.';

alter table public.menu_slots
  drop constraint if exists menu_slots_day_index_check;

alter table public.menu_slots
  add constraint menu_slots_day_index_check
  check (day_index >= 1 and day_index <= 6);

alter table public.menu_snacks
  drop constraint if exists menu_snacks_day_index_check;

alter table public.menu_snacks
  add constraint menu_snacks_day_index_check
  check (day_index >= 1 and day_index <= 6);

create or replace function public.create_menu_skeleton(
  p_day_count integer,
  p_servings integer default 2,
  p_meals text[] default array['breakfast', 'lunch', 'dinner']::text[]
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
  v_input text[] := coalesce(p_meals, array[]::text[]);
  v_allowed text[] := array[
    'breakfast',
    'second_breakfast',
    'lunch',
    'afternoon_snack',
    'dinner',
    'late_dinner'
  ];
  v_meals text[];
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_day_count not in (2, 4, 6) then
    raise exception 'invalid day_count';
  end if;

  if v_servings < 1 or v_servings > 20 then
    raise exception 'invalid servings';
  end if;

  if exists (
    select 1
    from unnest(v_input) as m
    where m <> all (v_allowed)
  ) then
    raise exception 'invalid meals';
  end if;

  select coalesce(array_agg(a), array[]::text[])
  into v_meals
  from unnest(v_allowed) as a
  where a = any (v_input);

  insert into public.menus (user_id, day_count, default_servings_per_meal)
  values (v_user_id, p_day_count, v_servings)
  returning id into v_menu_id;

  if cardinality(v_meals) > 0 then
    for v_day in 1..p_day_count loop
      foreach v_meal in array v_meals loop
        insert into public.menu_slots (menu_id, day_index, meal, recipe_id, servings)
        values (v_menu_id, v_day, v_meal, null, v_servings);
      end loop;
    end loop;
  end if;

  return v_menu_id;
end;
$$;
