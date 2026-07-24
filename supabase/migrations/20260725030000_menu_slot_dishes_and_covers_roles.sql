-- Story 6.1: MenuSlotDish child rows + Recipe.covers_roles + meal=snack.
-- Dual-write era: keep menu_slots.recipe_id / companion_recipe_id and menu_snacks.

-- 1) covers_roles on recipes
alter table public.recipes
  add column if not exists covers_roles text[] null;

alter table public.recipes
  drop constraint if exists recipes_covers_roles_check;

alter table public.recipes
  add constraint recipes_covers_roles_check
  check (
    covers_roles is null
    or covers_roles <@ array['main', 'soup', 'protein', 'veg', 'carb', 'snack']::text[]
  );

comment on column public.recipes.covers_roles is
  'Plate roles this recipe already satisfies (multi-role / one-pot). Null = no multi-cover.';

-- 2) Expand meal enum with snack (Перекус lane)
alter table public.menu_slots
  drop constraint if exists menu_slots_meal_check;

alter table public.menu_slots
  add constraint menu_slots_meal_check
  check (
    meal in (
      'breakfast',
      'second_breakfast',
      'lunch',
      'afternoon_snack',
      'dinner',
      'late_dinner',
      'snack'
    )
  );

comment on column public.menu_slots.meal is
  'Meal slot incl. snack (Перекус). Полдник remains afternoon_snack.';

-- 3) menu_slot_dishes
create table if not exists public.menu_slot_dishes (
  id uuid primary key default gen_random_uuid(),
  menu_slot_id uuid not null references public.menu_slots (id) on delete cascade,
  plate_role text not null
    check (plate_role in ('main', 'soup', 'protein', 'veg', 'carb', 'snack')),
  recipe_id uuid references public.recipes (id),
  snack_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_slot_dishes_item_xor check (
    (recipe_id is not null and snack_label is null)
    or (
      recipe_id is null
      and snack_label is not null
      and char_length(trim(snack_label)) > 0
    )
  ),
  constraint menu_slot_dishes_slot_role_unique unique (menu_slot_id, plate_role)
);

create index if not exists menu_slot_dishes_slot_idx
  on public.menu_slot_dishes (menu_slot_id);

create index if not exists menu_slot_dishes_recipe_idx
  on public.menu_slot_dishes (recipe_id)
  where recipe_id is not null;

comment on table public.menu_slot_dishes is
  'Role-labeled dishes on a meal slot (Harvard plate / soup / snack).';

alter table public.menu_slot_dishes enable row level security;

create policy "menu_slot_dishes_select_own"
  on public.menu_slot_dishes for select to authenticated
  using (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_slot_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

create policy "menu_slot_dishes_insert_own"
  on public.menu_slot_dishes for insert to authenticated
  with check (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_slot_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

create policy "menu_slot_dishes_update_own"
  on public.menu_slot_dishes for update to authenticated
  using (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_slot_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_slot_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

create policy "menu_slot_dishes_delete_own"
  on public.menu_slot_dishes for delete to authenticated
  using (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_slot_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

revoke all on table public.menu_slot_dishes from anon, public;
grant select, insert, update, delete on table public.menu_slot_dishes to authenticated;

-- 4) Backfill cookable slots → dishes (deterministic: L/D main→protein, companion→carb)
insert into public.menu_slot_dishes (menu_slot_id, plate_role, recipe_id, sort_order)
select
  s.id,
  case
    when s.meal in ('lunch', 'dinner', 'late_dinner') then 'protein'
    else 'main'
  end,
  s.recipe_id,
  case
    when s.meal in ('lunch', 'dinner', 'late_dinner') then 1
    else 0
  end
from public.menu_slots s
where s.recipe_id is not null
  and s.meal <> 'snack'
on conflict (menu_slot_id, plate_role) do nothing;

insert into public.menu_slot_dishes (menu_slot_id, plate_role, recipe_id, sort_order)
select
  s.id,
  'carb',
  s.companion_recipe_id,
  case when s.meal = 'lunch' then 3 else 2 end
from public.menu_slots s
where s.companion_recipe_id is not null
  and s.meal in ('lunch', 'dinner', 'late_dinner')
on conflict (menu_slot_id, plate_role) do nothing;

-- 5) Backfill menu_snacks → meal=snack slots + snack dishes
insert into public.menu_slots (menu_id, day_index, meal, recipe_id, servings)
select
  sn.menu_id,
  sn.day_index,
  'snack',
  null,
  coalesce(m.default_servings_per_meal, 2)
from public.menu_snacks sn
join public.menus m on m.id = sn.menu_id
where not exists (
  select 1
  from public.menu_slots s
  where s.menu_id = sn.menu_id
    and s.day_index = sn.day_index
    and s.meal = 'snack'
)
on conflict do nothing;

-- unique (menu_id, day_index, meal) should exist; if conflict on insert use that
insert into public.menu_slot_dishes (menu_slot_id, plate_role, snack_label, sort_order)
select
  s.id,
  'snack',
  sn.label,
  0
from public.menu_snacks sn
join public.menu_slots s
  on s.menu_id = sn.menu_id
 and s.day_index = sn.day_index
 and s.meal = 'snack'
on conflict (menu_slot_id, plate_role) do update
set snack_label = excluded.snack_label,
    updated_at = now();

-- 6) create_menu_skeleton: allow snack meal
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
    'late_dinner',
    'snack'
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
  'Create Menu + empty slots (incl. optional snack); snapshotted available_equipment.';
