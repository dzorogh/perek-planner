-- Enable Realtime for menu tables + Postgres lease lock for AI mutations.
-- Lease rows survive across pooled PostgREST calls; advisory xact lock
-- only serializes acquire attempts inside a single short transaction.

-- 1) Realtime publication (was empty)
alter publication supabase_realtime add table public.menus;
alter publication supabase_realtime add table public.menu_slots;
alter publication supabase_realtime add table public.menu_slot_dishes;
alter publication supabase_realtime add table public.menu_snacks;

-- DELETE payloads need non-PK columns for client-side menu scoping
alter table public.menu_slot_dishes replica identity full;

-- 2) Cross-instance mutation leases
create table if not exists public.menu_mutation_leases (
  menu_id uuid primary key references public.menus (id) on delete cascade,
  holder uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

comment on table public.menu_mutation_leases is
  'Short-lived lease so invent→assign on one menu cannot interleave across Next instances.';

alter table public.menu_mutation_leases enable row level security;

-- No direct table access; only security definer RPCs below.
revoke all on table public.menu_mutation_leases from authenticated, anon;

create or replace function public.try_acquire_menu_mutation_lock(p_menu_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lock_key bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.menus m
    where m.id = p_menu_id
      and m.user_id = uid
  ) then
    raise exception 'menu not found';
  end if;

  lock_key := hashtextextended(p_menu_id::text, 0);
  perform pg_advisory_xact_lock(lock_key);

  delete from public.menu_mutation_leases
  where menu_id = p_menu_id
    and expires_at < now();

  if exists (
    select 1
    from public.menu_mutation_leases
    where menu_id = p_menu_id
  ) then
    return false;
  end if;

  insert into public.menu_mutation_leases (menu_id, holder, expires_at)
  values (p_menu_id, uid, now() + interval '120 seconds');

  return true;
end;
$$;

create or replace function public.release_menu_mutation_lock(p_menu_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.menu_mutation_leases
  where menu_id = p_menu_id
    and holder = uid;
end;
$$;

revoke all on function public.try_acquire_menu_mutation_lock(uuid) from public;
revoke all on function public.release_menu_mutation_lock(uuid) from public;
grant execute on function public.try_acquire_menu_mutation_lock(uuid) to authenticated;
grant execute on function public.release_menu_mutation_lock(uuid) to authenticated;
