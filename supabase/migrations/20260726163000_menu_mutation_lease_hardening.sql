-- Harden mutation leases + Realtime DELETE payloads for slots/snacks.

alter table public.menu_slots replica identity full;
alter table public.menu_snacks replica identity full;

alter table public.menu_mutation_leases
  add column if not exists token uuid not null default gen_random_uuid();

drop function if exists public.release_menu_mutation_lock(uuid);
drop function if exists public.try_acquire_menu_mutation_lock(uuid);

create function public.try_acquire_menu_mutation_lock(p_menu_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lock_key bigint;
  new_token uuid;
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

  -- Same holder may reclaim after crash/retry (refresh token + TTL).
  update public.menu_mutation_leases
  set
    token = gen_random_uuid(),
    expires_at = now() + interval '10 minutes'
  where menu_id = p_menu_id
    and holder = uid
  returning token into new_token;

  if new_token is not null then
    return new_token;
  end if;

  if exists (
    select 1
    from public.menu_mutation_leases
    where menu_id = p_menu_id
  ) then
    return null;
  end if;

  insert into public.menu_mutation_leases (menu_id, holder, expires_at, token)
  values (p_menu_id, uid, now() + interval '10 minutes', gen_random_uuid())
  returning token into new_token;

  return new_token;
end;
$$;

create function public.release_menu_mutation_lock(
  p_menu_id uuid,
  p_token uuid
)
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
    and holder = uid
    and token = p_token;
end;
$$;

revoke all on function public.try_acquire_menu_mutation_lock(uuid) from public;
revoke all on function public.release_menu_mutation_lock(uuid, uuid) from public;
grant execute on function public.try_acquire_menu_mutation_lock(uuid) to authenticated;
grant execute on function public.release_menu_mutation_lock(uuid, uuid) to authenticated;
