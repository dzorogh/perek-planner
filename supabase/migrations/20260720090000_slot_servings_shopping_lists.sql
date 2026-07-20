-- Epic 3: per-slot servings + Shopping list snapshot (AD-11).

alter table public.menu_slots
  add column if not exists servings integer not null default 2
    check (servings >= 1 and servings <= 20);

comment on column public.menu_slots.servings is
  'Portion-plan servings for this day×meal (Story 3.1). Default 2 (FR2).';

-- Backfill already handled by DEFAULT for new rows; existing get 2 via DEFAULT on add.

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null unique references public.menus (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shopping_lists is
  'Materialized Shopping list snapshot per Menu (AD-11). Regenerating replaces lines.';

create table if not exists public.shopping_list_lines (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists (id) on delete cascade,
  product_id uuid null references public.products (id),
  product_name text not null,
  line_kind text not null check (line_kind in ('matched', 'pantry', 'snack')),
  checked_match_id uuid null references public.checked_matches (id) on delete set null,
  price_cents integer null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.shopping_list_lines is
  'Snapshot lines: matched (from CheckedMatch), pantry staples, snacks. No in-app edit.';

create index if not exists shopping_list_lines_list_idx
  on public.shopping_list_lines (shopping_list_id);

alter table public.shopping_lists enable row level security;
alter table public.shopping_list_lines enable row level security;

create policy "shopping_lists_select_own"
  on public.shopping_lists for select to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = shopping_lists.menu_id and m.user_id = auth.uid()
    )
  );

create policy "shopping_lists_insert_own"
  on public.shopping_lists for insert to authenticated
  with check (
    exists (
      select 1 from public.menus m
      where m.id = shopping_lists.menu_id and m.user_id = auth.uid()
    )
  );

create policy "shopping_lists_update_own"
  on public.shopping_lists for update to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = shopping_lists.menu_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.menus m
      where m.id = shopping_lists.menu_id and m.user_id = auth.uid()
    )
  );

create policy "shopping_lists_delete_own"
  on public.shopping_lists for delete to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = shopping_lists.menu_id and m.user_id = auth.uid()
    )
  );

create policy "shopping_list_lines_select_own"
  on public.shopping_list_lines for select to authenticated
  using (
    exists (
      select 1
      from public.shopping_lists sl
      join public.menus m on m.id = sl.menu_id
      where sl.id = shopping_list_lines.shopping_list_id and m.user_id = auth.uid()
    )
  );

create policy "shopping_list_lines_insert_own"
  on public.shopping_list_lines for insert to authenticated
  with check (
    exists (
      select 1
      from public.shopping_lists sl
      join public.menus m on m.id = sl.menu_id
      where sl.id = shopping_list_lines.shopping_list_id and m.user_id = auth.uid()
    )
  );

create policy "shopping_list_lines_delete_own"
  on public.shopping_list_lines for delete to authenticated
  using (
    exists (
      select 1
      from public.shopping_lists sl
      join public.menus m on m.id = sl.menu_id
      where sl.id = shopping_list_lines.shopping_list_id and m.user_id = auth.uid()
    )
  );

revoke all on table public.shopping_lists from anon, public;
revoke all on table public.shopping_list_lines from anon, public;
grant select, insert, update, delete on table public.shopping_lists to authenticated;
grant select, insert, delete on table public.shopping_list_lines to authenticated;
