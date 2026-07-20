-- Story 2.1: Menu skeleton (AD-9 store snapshot, Model C slots, FR12 fridge-keep prep).
-- day_index is 1..day_count (documented; constrained 1..4 to match day_count domain).

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fridge_keep_days integer not null check (fridge_keep_days >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipes is
  'Minimal Recipe reference for MenuSlot FK and FR12 fridge-keep prep. Matching/ingredients come in Story 2.2.';

comment on column public.recipes.fridge_keep_days is
  'Days the dish keeps in the fridge; eligibility vs Menu length is Story 2.2.';

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id),
  day_count integer not null check (day_count in (1, 2, 3, 4)),
  default_servings_per_meal integer not null default 2
    check (default_servings_per_meal >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.menus is
  'Operator Menu plan. store_id is snapshotted from Settings at create (AD-9); Settings changes do not rewrite past Menus.';

comment on column public.menus.store_id is
  'AD-9 snapshot of user_settings.selected_store_id at Menu creation.';

comment on column public.menus.day_count is
  'Menu length 1–4 days (FR-1). Slots use day_index 1..day_count.';

comment on column public.menus.default_servings_per_meal is
  'FR-2 default people per meal (default 2). Portion-plan UI is Epic 3.';

create index if not exists menus_user_created_idx
  on public.menus (user_id, created_at desc);

create table if not exists public.menu_slots (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  day_index integer not null check (day_index >= 1 and day_index <= 4),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid references public.recipes (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_id, day_index, meal)
);

comment on table public.menu_slots is
  'Model C day × meal slots (breakfast/lunch/dinner). Empty slot = recipe_id null.';

comment on column public.menu_slots.day_index is
  '1-based day within menus.day_count (always 1..day_count for valid skeletons).';

create index if not exists menu_slots_menu_idx
  on public.menu_slots (menu_id);

-- RLS -----------------------------------------------------------------------

alter table public.recipes enable row level security;
alter table public.menus enable row level security;
alter table public.menu_slots enable row level security;

create policy "recipes_select_authenticated"
  on public.recipes
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE for authenticated on recipes in 2.1 (seed/service later).

create policy "menus_select_own"
  on public.menus
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "menus_insert_own"
  on public.menus
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "menus_update_own"
  on public.menus
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "menus_delete_own"
  on public.menus
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "menu_slots_select_own"
  on public.menu_slots
  for select
  to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = menu_slots.menu_id and m.user_id = auth.uid()
    )
  );

create policy "menu_slots_insert_own"
  on public.menu_slots
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.menus m
      where m.id = menu_slots.menu_id and m.user_id = auth.uid()
    )
  );

create policy "menu_slots_update_own"
  on public.menu_slots
  for update
  to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = menu_slots.menu_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.menus m
      where m.id = menu_slots.menu_id and m.user_id = auth.uid()
    )
  );

create policy "menu_slots_delete_own"
  on public.menu_slots
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = menu_slots.menu_id and m.user_id = auth.uid()
    )
  );

revoke all on table public.recipes from anon;
revoke all on table public.menus from anon;
revoke all on table public.menu_slots from anon;

revoke all on table public.recipes from authenticated;
revoke all on table public.menus from authenticated;
revoke all on table public.menu_slots from authenticated;

grant select on table public.recipes to authenticated;
grant select, insert, update, delete on table public.menus to authenticated;
grant select, insert, update, delete on table public.menu_slots to authenticated;

-- Atomic skeleton create (menu + day_count×3 empty slots) -----------------

create or replace function public.create_menu_skeleton(
  p_store_id uuid,
  p_day_count integer
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
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_day_count not in (1, 2, 3, 4) then
    raise exception 'invalid day_count';
  end if;

  if p_store_id is null then
    raise exception 'store_id required';
  end if;

  insert into public.menus (user_id, store_id, day_count, default_servings_per_meal)
  values (v_user_id, p_store_id, p_day_count, 2)
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

comment on function public.create_menu_skeleton(uuid, integer) is
  'Story 2.1: atomically create Menu + empty Model C slots for the session user.';

revoke all on function public.create_menu_skeleton(uuid, integer) from public;
revoke all on function public.create_menu_skeleton(uuid, integer) from anon;
grant execute on function public.create_menu_skeleton(uuid, integer) to authenticated;
