-- Story 2.2: CriticalIngredient + Menu-scoped CheckedMatch (AD-3, AD-7).
-- Fridge-keep remains on recipes.fridge_keep_days (no FridgeKeep table).

create table if not exists public.critical_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('critical', 'pantry')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, name)
);

comment on table public.critical_ingredients is
  'Recipe Critical/Pantry ingredients for matching eligibility (Story 2.2). kind=pantry gates catalog presence (FR-13).';

comment on column public.critical_ingredients.name is
  'Match key against products.name (case-insensitive containment / tokens).';

comment on column public.critical_ingredients.kind is
  'critical = needs in-stock CheckedMatch; pantry = catalog presence gate (list lines Epic 3).';

create index if not exists critical_ingredients_recipe_idx
  on public.critical_ingredients (recipe_id);

create table if not exists public.checked_matches (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  critical_ingredient_id uuid not null references public.critical_ingredients (id) on delete cascade,
  product_id uuid not null references public.products (id),
  menu_slot_id uuid null references public.menu_slots (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Pre-assign matching (2.2): one resolution per Menu × Critical ingredient.
  unique (menu_id, critical_ingredient_id)
);

comment on table public.checked_matches is
  'Menu-scoped CheckedMatch rows (AD-7). Written only by Next matching module. menu_slot_id nullable until slot assign (2.3/2.4).';

create index if not exists checked_matches_menu_idx
  on public.checked_matches (menu_id);

create index if not exists checked_matches_menu_recipe_idx
  on public.checked_matches (menu_id, recipe_id);

-- RLS -----------------------------------------------------------------------

alter table public.critical_ingredients enable row level security;
alter table public.checked_matches enable row level security;

create policy "critical_ingredients_select_authenticated"
  on public.critical_ingredients
  for select
  to authenticated
  using (true);

-- Seed/migrations write recipes+ingredients; no authenticated writes in 2.2.

create policy "checked_matches_select_own"
  on public.checked_matches
  for select
  to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = checked_matches.menu_id and m.user_id = auth.uid()
    )
  );

create policy "checked_matches_insert_own"
  on public.checked_matches
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.menus m
      where m.id = checked_matches.menu_id and m.user_id = auth.uid()
    )
  );

create policy "checked_matches_update_own"
  on public.checked_matches
  for update
  to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = checked_matches.menu_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.menus m
      where m.id = checked_matches.menu_id and m.user_id = auth.uid()
    )
  );

create policy "checked_matches_delete_own"
  on public.checked_matches
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = checked_matches.menu_id and m.user_id = auth.uid()
    )
  );

revoke all on table public.critical_ingredients from anon;
revoke all on table public.checked_matches from anon;

revoke all on table public.critical_ingredients from authenticated;
revoke all on table public.checked_matches from authenticated;

grant select on table public.critical_ingredients to authenticated;
grant select, insert, update, delete on table public.checked_matches to authenticated;

-- Seed recipes for matching smoke (stable UUIDs) -----------------------------
-- Recipe A: fridge 4d, critical + pantry — can match if catalog has products
-- Recipe B: fridge 1d — fails fridge-keep for menus longer than 1 day

insert into public.recipes (id, name, fridge_keep_days)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'Тушёная курица с гречкой',
    4
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'Омлет со свежей зеленью',
    1
  )
on conflict (id) do nothing;

insert into public.critical_ingredients (id, recipe_id, name, kind, sort_order)
values
  (
    'c2000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'курица',
    'critical',
    1
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'гречка',
    'critical',
    2
  ),
  (
    'c2000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000001',
    'соль',
    'pantry',
    3
  ),
  (
    'c2000000-0000-4000-8000-000000000004',
    'b2000000-0000-4000-8000-000000000002',
    'яйца',
    'critical',
    1
  ),
  (
    'c2000000-0000-4000-8000-000000000005',
    'b2000000-0000-4000-8000-000000000002',
    'зелень',
    'critical',
    2
  )
on conflict (recipe_id, name) do nothing;
