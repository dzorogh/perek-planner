-- Story 1.2: minimal user-owned table + RLS (AD-5 / NFR5).
-- selected_store_id + stores FK deferred to Story 1.3.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'Per-operator settings. Store selection columns added in Story 1.3.';

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_settings_delete_own"
  on public.user_settings
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Explicit deny for anon: no policies for role anon → RLS blocks all access.
revoke all on table public.user_settings from anon;
grant select, insert, update, delete on table public.user_settings to authenticated;
