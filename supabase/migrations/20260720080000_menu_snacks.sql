-- Story 2.5: Menu-scoped no-cook Snacks (product chips). Shopping list lines in Epic 3.

create table if not exists public.menu_snacks (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  product_id uuid not null references public.products (id),
  created_at timestamptz not null default now(),
  unique (menu_id, product_id)
);

comment on table public.menu_snacks is
  'No-cook Snacks on a Menu (FR4). Product refs only — not meal slots / not cook session. List lines Epic 3.';

create index if not exists menu_snacks_menu_idx on public.menu_snacks (menu_id);

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
