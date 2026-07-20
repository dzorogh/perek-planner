-- Story 1.4: products + catalog_sync_runs (AD-2, AD-8).
-- Freshness for Story 1.5 (FR-18): latest catalog_sync_runs row for the active store.
-- Recommended "fresh": status = 'success' AND finished_at >= now() - interval '24 hours' (UTC).
-- Do NOT use products.updated_at for stale detection.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  external_id text not null,
  name text not null,
  price_cents integer null check (price_cents is null or price_cents >= 0),
  availability_status text not null check (
    availability_status in ('in_stock', 'out_of_stock', 'unknown')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, external_id)
);

comment on table public.products is
  'Store-scoped catalog. Sole writer: Python sync worker (service role). Availability: availability_status only (AD-8).';

comment on column public.products.availability_status is
  'Single availability field written by sync: in_stock | out_of_stock | unknown.';

create index if not exists products_store_id_idx on public.products (store_id);

create table if not exists public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_message text null,
  products_upserted integer null
);

comment on table public.catalog_sync_runs is
  'Sync run log. FR-18 / Story 1.5 reads latest row per store for stale signal (not products.updated_at). Fresh ≈ success within 24h UTC.';

create index if not exists catalog_sync_runs_store_started_idx
  on public.catalog_sync_runs (store_id, started_at desc);

alter table public.products enable row level security;
alter table public.catalog_sync_runs enable row level security;

create policy "products_select_authenticated"
  on public.products
  for select
  to authenticated
  using (true);

create policy "catalog_sync_runs_select_authenticated"
  on public.catalog_sync_runs
  for select
  to authenticated
  using (true);

-- No write policies for authenticated — service role / migrations only.
revoke all on table public.products from anon;
revoke all on table public.products from authenticated;
grant select on table public.products to authenticated;

revoke all on table public.catalog_sync_runs from anon;
revoke all on table public.catalog_sync_runs from authenticated;
grant select on table public.catalog_sync_runs to authenticated;
