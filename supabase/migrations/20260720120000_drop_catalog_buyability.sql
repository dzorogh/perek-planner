-- Drop store-catalog buyability: no stores/products/sync/checked_matches.
-- Planner keeps recipes + ingredient-name shopping lists + free-text snacks.

-- ---------------------------------------------------------------------------
-- 1. Clear shopping snapshot lines (schema rewrite)
-- ---------------------------------------------------------------------------
truncate public.shopping_list_lines;

alter table public.shopping_list_lines
  drop constraint if exists shopping_list_lines_product_id_fkey;

alter table public.shopping_list_lines
  drop constraint if exists shopping_list_lines_checked_match_id_fkey;

alter table public.shopping_list_lines
  drop column if exists product_id;

alter table public.shopping_list_lines
  drop column if exists checked_match_id;

alter table public.shopping_list_lines
  drop column if exists price_cents;

-- Rename product_name → ingredient_name when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shopping_list_lines'
      and column_name = 'product_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shopping_list_lines'
      and column_name = 'ingredient_name'
  ) then
    alter table public.shopping_list_lines rename column product_name to ingredient_name;
  end if;
end $$;

alter table public.shopping_list_lines
  add column if not exists ingredient_name text;

update public.shopping_list_lines
set ingredient_name = coalesce(ingredient_name, '')
where ingredient_name is null;

alter table public.shopping_list_lines
  alter column ingredient_name set not null;

alter table public.shopping_list_lines
  drop constraint if exists shopping_list_lines_line_kind_check;

alter table public.shopping_list_lines
  add constraint shopping_list_lines_line_kind_check
  check (line_kind in ('ingredient', 'pantry', 'snack'));

comment on table public.shopping_list_lines is
  'Snapshot lines from recipe critical_ingredients + free-text snacks. No SKU/price.';

comment on column public.shopping_list_lines.ingredient_name is
  'Display name for the shopping line (ingredient or snack label).';

-- ---------------------------------------------------------------------------
-- 2. menu_snacks: product_id → label
-- ---------------------------------------------------------------------------
drop table if exists public.menu_snacks cascade;

create table public.menu_snacks (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (menu_id, label),
  constraint menu_snacks_label_nonempty check (char_length(trim(label)) > 0)
);

comment on table public.menu_snacks is
  'No-cook free-text snacks on a Menu (no product catalog).';

create index menu_snacks_menu_idx on public.menu_snacks (menu_id);

alter table public.menu_snacks enable row level security;

create policy "menu_snacks_select_own"
  on public.menu_snacks for select to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = menu_snacks.menu_id and m.user_id = auth.uid()
    )
  );

create policy "menu_snacks_insert_own"
  on public.menu_snacks for insert to authenticated
  with check (
    exists (
      select 1 from public.menus m
      where m.id = menu_snacks.menu_id and m.user_id = auth.uid()
    )
  );

create policy "menu_snacks_delete_own"
  on public.menu_snacks for delete to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = menu_snacks.menu_id and m.user_id = auth.uid()
    )
  );

revoke all on table public.menu_snacks from anon, public;
grant select, insert, delete on table public.menu_snacks to authenticated;

-- ---------------------------------------------------------------------------
-- 3. snack_ratings: product_id → label
-- ---------------------------------------------------------------------------
drop trigger if exists snack_ratings_set_updated_at on public.snack_ratings;
drop table if exists public.snack_ratings cascade;

create table public.snack_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  rating text not null check (rating in ('dislike', 'medium', 'like')),
  reason text null
    check (
      reason is null
      or reason in ('too_hard', 'not_tasty', 'too_long', 'other')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, label),
  constraint snack_ratings_label_nonempty check (char_length(trim(label)) > 0)
);

comment on table public.snack_ratings is
  'Operator rating of a free-text snack label. dislike hard-suppresses that label.';

create index snack_ratings_user_idx on public.snack_ratings (user_id);

alter table public.snack_ratings enable row level security;

create policy "snack_ratings_select_own"
  on public.snack_ratings for select to authenticated
  using (user_id = auth.uid());

create policy "snack_ratings_insert_own"
  on public.snack_ratings for insert to authenticated
  with check (user_id = auth.uid());

create policy "snack_ratings_update_own"
  on public.snack_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "snack_ratings_delete_own"
  on public.snack_ratings for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.snack_ratings from anon, public;
grant select, insert, update, delete on table public.snack_ratings to authenticated;

create or replace function public.snack_ratings_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger snack_ratings_set_updated_at
  before update on public.snack_ratings
  for each row
  execute function public.snack_ratings_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Drop checked_matches + helpers
-- ---------------------------------------------------------------------------
drop function if exists public.replace_checked_matches(uuid, uuid, jsonb);
drop trigger if exists checked_matches_enforce_consistency_trg on public.checked_matches;
drop function if exists public.checked_matches_enforce_consistency();
drop table if exists public.checked_matches cascade;

-- ---------------------------------------------------------------------------
-- 5. menus: drop store_id; rewrite freeze + create_menu_skeleton
-- ---------------------------------------------------------------------------
drop trigger if exists menus_freeze_snapshot_columns_trg on public.menus;

alter table public.menus
  drop constraint if exists menus_store_id_fkey;

alter table public.menus
  drop column if exists store_id;

create or replace function public.menus_freeze_snapshot_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.day_count is distinct from old.day_count then
    raise exception 'menus.day_count is immutable after create';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'menus.user_id is immutable';
  end if;
  return new;
end;
$$;

create trigger menus_freeze_snapshot_columns_trg
  before update on public.menus
  for each row
  execute function public.menus_freeze_snapshot_columns();

create or replace function public.create_menu_skeleton(p_day_count integer)
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
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_day_count not in (1, 2, 3, 4) then
    raise exception 'invalid day_count';
  end if;

  insert into public.menus (user_id, day_count, default_servings_per_meal)
  values (v_user_id, p_day_count, 2)
  returning id into v_menu_id;

  for v_day in 1..p_day_count loop
    foreach v_meal in array array['breakfast', 'lunch', 'dinner']::text[] loop
      insert into public.menu_slots (menu_id, day_index, meal, recipe_id)
      values (v_menu_id, v_day, v_meal, null);
    end loop;
  end loop;

  return v_menu_id;
end;
$$;

comment on function public.create_menu_skeleton(integer) is
  'Create Menu + empty slots for auth user. No store / catalog freshness.';

revoke all on function public.create_menu_skeleton(integer) from public;
revoke all on function public.create_menu_skeleton(integer) from anon;
grant execute on function public.create_menu_skeleton(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Drop catalog tables + selected_store
-- ---------------------------------------------------------------------------
alter table public.user_settings
  drop constraint if exists user_settings_selected_store_id_fkey;

alter table public.user_settings
  drop column if exists selected_store_id;

drop table if exists public.catalog_sync_runs cascade;
drop table if exists public.products cascade;
drop table if exists public.stores cascade;

-- ---------------------------------------------------------------------------
-- 7. Allow authenticated to invent recipes into shared library
-- ---------------------------------------------------------------------------
create policy "recipes_insert_authenticated"
  on public.recipes for insert to authenticated
  with check (true);

create policy "recipes_update_authenticated"
  on public.recipes for update to authenticated
  using (true)
  with check (true);

grant insert, update on table public.recipes to authenticated;

create policy "critical_ingredients_insert_authenticated"
  on public.critical_ingredients for insert to authenticated
  with check (true);

grant insert on table public.critical_ingredients to authenticated;
