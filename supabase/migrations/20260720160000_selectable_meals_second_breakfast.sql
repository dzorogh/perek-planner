-- Selectable meal types at menu create; add second_breakfast slot.

alter table public.menu_slots
  drop constraint if exists menu_slots_meal_check;

alter table public.menu_slots
  add constraint menu_slots_meal_check
  check (meal in ('breakfast', 'second_breakfast', 'lunch', 'dinner'));

comment on column public.menu_slots.meal is
  'Meal slot: breakfast | second_breakfast | lunch | dinner. Which meals exist is chosen at create.';

drop function if exists public.create_menu_skeleton(integer, integer);

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
  v_allowed text[] := array['breakfast', 'second_breakfast', 'lunch', 'dinner'];
  v_meals text[];
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

  if exists (
    select 1
    from unnest(v_input) as m
    where m <> all (v_allowed)
  ) then
    raise exception 'invalid meals';
  end if;

  -- Stable canonical order; dedupe by intersecting with allowed list.
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

comment on function public.create_menu_skeleton(integer, integer, text[]) is
  'Create Menu + empty slots for selected meals; p_servings = people count; empty p_meals allowed (snacks-only).';

revoke all on function public.create_menu_skeleton(integer, integer, text[]) from public;
revoke all on function public.create_menu_skeleton(integer, integer, text[]) from anon;
grant execute on function public.create_menu_skeleton(integer, integer, text[]) to authenticated;
