-- Story 1.3: stores catalog seed + user_settings.selected_store_id (AD-9).
-- Default store: д. Алабино, 92 (stable UUID for app defaults).

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  chain text not null check (chain = 'primary'),
  external_id text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stores is
  'Stores for Settings picker. Catalog sync (Story 1.4) uses external_id.';

-- Stable default UUID — keep in sync with src/domain/settings/constants.ts
insert into public.stores (id, chain, external_id, display_name)
values (
  'a1000000-0000-4000-8000-000000000001',
  'primary',
  'alabino-92',
  'д. Алабино, 92'
)
on conflict (id) do nothing;

alter table public.user_settings
  add column if not exists selected_store_id uuid references public.stores (id);

comment on column public.user_settings.selected_store_id is
  'Live store preference (AD-9). Null until app initializes default Alabino.';

alter table public.stores enable row level security;

create policy "stores_select_authenticated"
  on public.stores
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies for authenticated — writes via service role / migrations only.
-- Supabase defaults often GRANT ALL to authenticated on new tables — revoke writes explicitly.
revoke all on table public.stores from anon;
revoke all on table public.stores from authenticated;
grant select on table public.stores to authenticated;
