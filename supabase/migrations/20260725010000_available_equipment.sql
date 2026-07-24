-- Available kitchen equipment: profile default, menu snapshot, recipe requirements.

-- 1) Columns
alter table public.user_settings
  add column if not exists available_equipment text[] not null
    default array['stove', 'oven']::text[];

alter table public.menus
  add column if not exists available_equipment text[] not null
    default array['stove', 'oven']::text[];

alter table public.recipes
  add column if not exists required_equipment text[] not null
    default array['stove', 'oven']::text[];

comment on column public.user_settings.available_equipment is
  'Operator kitchen equipment default; pre-fills create-menu picker.';

comment on column public.menus.available_equipment is
  'Snapshot of equipment allowed for this menu; hard filter for AI/candidates.';

comment on column public.recipes.required_equipment is
  'Equipment required to cook this recipe; must be ⊆ menu.available_equipment.';

-- 2) Vocabulary checks (array contained in closed set; non-empty)
alter table public.user_settings
  drop constraint if exists user_settings_available_equipment_check;
alter table public.user_settings
  add constraint user_settings_available_equipment_check
  check (
    cardinality(available_equipment) >= 1
    and available_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

alter table public.menus
  drop constraint if exists menus_available_equipment_check;
alter table public.menus
  add constraint menus_available_equipment_check
  check (
    cardinality(available_equipment) >= 1
    and available_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

alter table public.recipes
  drop constraint if exists recipes_required_equipment_check;
alter table public.recipes
  add constraint recipes_required_equipment_check
  check (
    cardinality(required_equipment) >= 1
    and required_equipment <@ array[
      'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
    ]::text[]
  );

-- 3) Seed backfill (known stove-only; others keep default stove+oven)
update public.recipes
set required_equipment = array['stove']::text[]
where id in (
  'b2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002'
);

-- 4) 4-arg create_menu_skeleton with p_equipment
create or replace function public.create_menu_skeleton(
  p_day_count integer,
  p_servings integer default 2,
  p_meals text[] default array['breakfast', 'lunch', 'dinner']::text[],
  p_equipment text[] default array['stove', 'oven']::text[]
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
  v_equip_input text[] := coalesce(p_equipment, array['stove', 'oven']::text[]);
  v_equip_allowed text[] := array[
    'stove','oven','air_fryer','grill','multicooker','pressure_cooker','microwave'
  ];
  v_equipment text[];
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

  if cardinality(v_equip_input) < 1
     or exists (
       select 1
       from unnest(v_equip_input) as e
       where e <> all (v_equip_allowed)
     )
  then
    raise exception 'invalid equipment';
  end if;

  select coalesce(array_agg(a), array[]::text[])
  into v_meals
  from unnest(v_allowed) as a
  where a = any (v_input);

  select coalesce(array_agg(distinct e), array[]::text[])
  into v_equipment
  from unnest(v_equip_input) as e
  where e = any (v_equip_allowed);

  if cardinality(v_equipment) < 1 then
    raise exception 'invalid equipment';
  end if;

  insert into public.menus (user_id, day_count, default_servings_per_meal, available_equipment)
  values (v_user_id, p_day_count, v_servings, v_equipment)
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

comment on function public.create_menu_skeleton(integer, integer, text[], text[]) is
  'Create Menu + empty slots; snapshotted available_equipment; meals optional for snacks-only.';

revoke all on function public.create_menu_skeleton(integer, integer, text[], text[]) from public;
revoke all on function public.create_menu_skeleton(integer, integer, text[], text[]) from anon;
grant execute on function public.create_menu_skeleton(integer, integer, text[], text[]) to authenticated;

-- Keep 3-arg overload for older clients (delegates to 4-arg with default equipment).
create or replace function public.create_menu_skeleton(
  p_day_count integer,
  p_servings integer default 2,
  p_meals text[] default array['breakfast', 'lunch', 'dinner']::text[]
)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select public.create_menu_skeleton(
    p_day_count,
    p_servings,
    p_meals,
    array['stove', 'oven']::text[]
  );
$$;

comment on function public.create_menu_skeleton(integer, integer, text[]) is
  'Compatibility wrapper; defaults available_equipment to stove+oven.';

revoke all on function public.create_menu_skeleton(integer, integer, text[]) from public;
revoke all on function public.create_menu_skeleton(integer, integer, text[]) from anon;
grant execute on function public.create_menu_skeleton(integer, integer, text[]) to authenticated;
