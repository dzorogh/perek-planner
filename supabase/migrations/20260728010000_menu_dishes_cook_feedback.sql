-- Unify menu_slot_dishes + menu_snacks → menu_dishes; add cook feedback.

-- 1) Rename dish-line table
alter table public.menu_slot_dishes rename to menu_dishes;

alter index if exists public.menu_slot_dishes_slot_idx rename to menu_dishes_slot_idx;
alter index if exists public.menu_slot_dishes_recipe_idx rename to menu_dishes_recipe_idx;

alter table public.menu_dishes rename constraint menu_slot_dishes_pkey to menu_dishes_pkey;
alter table public.menu_dishes rename constraint menu_slot_dishes_menu_slot_id_fkey to menu_dishes_menu_slot_id_fkey;
alter table public.menu_dishes rename constraint menu_slot_dishes_recipe_id_fkey to menu_dishes_recipe_id_fkey;
alter table public.menu_dishes rename constraint menu_slot_dishes_item_xor to menu_dishes_item_xor;
alter table public.menu_dishes rename constraint menu_slot_dishes_slot_role_unique to menu_dishes_slot_role_unique;
alter table public.menu_dishes rename constraint menu_slot_dishes_plate_role_check to menu_dishes_plate_role_check;

comment on table public.menu_dishes is
  'Menu dish lines on a meal slot (recipe or no-cook snack) with cook feedback.';

-- 2) Cook feedback + snack nutrition (from former menu_snacks)
alter table public.menu_dishes
  add column if not exists prepared boolean not null default false;

alter table public.menu_dishes
  add column if not exists rating text null;

alter table public.menu_dishes
  drop constraint if exists menu_dishes_rating_check;

alter table public.menu_dishes
  add constraint menu_dishes_rating_check
  check (rating is null or rating in ('like', 'dislike'));

alter table public.menu_dishes
  add column if not exists price_cents_per_serving integer null;

alter table public.menu_dishes
  add column if not exists calories_kcal_per_serving integer null;

alter table public.menu_dishes
  add column if not exists protein_g_per_serving numeric null;

alter table public.menu_dishes
  add column if not exists fat_g_per_serving numeric null;

alter table public.menu_dishes
  add column if not exists carbs_g_per_serving numeric null;

alter table public.menu_dishes
  drop constraint if exists menu_dishes_price_cents_check;
alter table public.menu_dishes
  add constraint menu_dishes_price_cents_check
  check (price_cents_per_serving is null or price_cents_per_serving >= 0);

alter table public.menu_dishes
  drop constraint if exists menu_dishes_calories_check;
alter table public.menu_dishes
  add constraint menu_dishes_calories_check
  check (calories_kcal_per_serving is null or calories_kcal_per_serving >= 0);

alter table public.menu_dishes
  drop constraint if exists menu_dishes_protein_check;
alter table public.menu_dishes
  add constraint menu_dishes_protein_check
  check (protein_g_per_serving is null or protein_g_per_serving >= 0);

alter table public.menu_dishes
  drop constraint if exists menu_dishes_fat_check;
alter table public.menu_dishes
  add constraint menu_dishes_fat_check
  check (fat_g_per_serving is null or fat_g_per_serving >= 0);

alter table public.menu_dishes
  drop constraint if exists menu_dishes_carbs_check;
alter table public.menu_dishes
  add constraint menu_dishes_carbs_check
  check (carbs_g_per_serving is null or carbs_g_per_serving >= 0);

comment on column public.menu_dishes.prepared is
  'Operator marked this menu dish as cooked/prepared for this menu.';
comment on column public.menu_dishes.rating is
  'Per-menu cook feedback: like | dislike | null. Does not steer future AI.';
comment on column public.menu_dishes.price_cents_per_serving is
  'Snack nutrition/price (kopecks per adult serving); null for recipe dishes or unknown.';

-- 3) Ensure snack meal slots exist for every menu_snacks row
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

-- 4) Upsert snack dishes from menu_snacks (label + nutrition)
insert into public.menu_dishes (
  menu_slot_id,
  plate_role,
  recipe_id,
  snack_label,
  sort_order,
  price_cents_per_serving,
  calories_kcal_per_serving,
  protein_g_per_serving,
  fat_g_per_serving,
  carbs_g_per_serving,
  updated_at
)
select
  s.id,
  'snack',
  null,
  sn.label,
  0,
  sn.price_cents_per_serving,
  sn.calories_kcal_per_serving,
  sn.protein_g_per_serving,
  sn.fat_g_per_serving,
  sn.carbs_g_per_serving,
  now()
from public.menu_snacks sn
join public.menu_slots s
  on s.menu_id = sn.menu_id
 and s.day_index = sn.day_index
 and s.meal = 'snack'
on conflict (menu_slot_id, plate_role) do update
set
  snack_label = excluded.snack_label,
  recipe_id = null,
  price_cents_per_serving = excluded.price_cents_per_serving,
  calories_kcal_per_serving = excluded.calories_kcal_per_serving,
  protein_g_per_serving = excluded.protein_g_per_serving,
  fat_g_per_serving = excluded.fat_g_per_serving,
  carbs_g_per_serving = excluded.carbs_g_per_serving,
  updated_at = now();

-- 5) RLS policies under new table name
drop policy if exists "menu_slot_dishes_select_own" on public.menu_dishes;
drop policy if exists "menu_slot_dishes_insert_own" on public.menu_dishes;
drop policy if exists "menu_slot_dishes_update_own" on public.menu_dishes;
drop policy if exists "menu_slot_dishes_delete_own" on public.menu_dishes;
drop policy if exists "menu_dishes_select_own" on public.menu_dishes;
drop policy if exists "menu_dishes_insert_own" on public.menu_dishes;
drop policy if exists "menu_dishes_update_own" on public.menu_dishes;
drop policy if exists "menu_dishes_delete_own" on public.menu_dishes;

create policy "menu_dishes_select_own"
  on public.menu_dishes for select to authenticated
  using (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

create policy "menu_dishes_insert_own"
  on public.menu_dishes for insert to authenticated
  with check (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

create policy "menu_dishes_update_own"
  on public.menu_dishes for update to authenticated
  using (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

create policy "menu_dishes_delete_own"
  on public.menu_dishes for delete to authenticated
  using (
    exists (
      select 1
      from public.menu_slots s
      join public.menus m on m.id = s.menu_id
      where s.id = menu_dishes.menu_slot_id
        and m.user_id = auth.uid()
    )
  );

revoke all on table public.menu_dishes from anon, public;
grant select, insert, update, delete on table public.menu_dishes to authenticated;

-- 6) Realtime: drop legacy snack table; renamed dishes stay in publication
alter publication supabase_realtime drop table public.menu_snacks;

drop trigger if exists menu_snacks_day_index_within_menu_trg on public.menu_snacks;
drop function if exists public.menu_snacks_day_index_within_menu();

drop table public.menu_snacks cascade;

-- Keep DELETE payloads with non-PK columns for client menu scoping
alter table public.menu_dishes replica identity full;
