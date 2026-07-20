-- Story 2.1 review patches: AD-8 freshness + AD-9 store in RPC;
-- freeze menus.store_id/day_count; enforce day_index <= day_count.

-- Replace create_menu_skeleton: only p_day_count; store from Settings; freshness in-SQL.
drop function if exists public.create_menu_skeleton(uuid, integer);

create or replace function public.create_menu_skeleton(p_day_count integer)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_menu_id uuid;
  v_day integer;
  v_meal text;
  v_run_status text;
  v_run_finished timestamptz;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_day_count not in (1, 2, 3, 4) then
    raise exception 'invalid day_count';
  end if;

  select selected_store_id
    into v_store_id
  from public.user_settings
  where user_id = v_user_id;

  if v_store_id is null then
    raise exception 'store not selected';
  end if;

  -- AD-8: latest catalog_sync_runs row for snapshotted store must be fresh success.
  select status, finished_at
    into v_run_status, v_run_finished
  from public.catalog_sync_runs
  where store_id = v_store_id
  order by started_at desc
  limit 1;

  if v_run_status is distinct from 'success'
     or v_run_finished is null
     or v_run_finished < (now() - interval '24 hours') then
    raise exception 'catalog not fresh';
  end if;

  insert into public.menus (user_id, store_id, day_count, default_servings_per_meal)
  values (v_user_id, v_store_id, p_day_count, 2)
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
  'Story 2.1: create Menu + empty slots; store from user_settings; AD-8 freshness enforced in-SQL.';

revoke all on function public.create_menu_skeleton(integer) from public;
revoke all on function public.create_menu_skeleton(integer) from anon;
grant execute on function public.create_menu_skeleton(integer) to authenticated;

-- Freeze AD-9 snapshot fields after create.
create or replace function public.menus_freeze_snapshot_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception 'menus.store_id is immutable (AD-9 snapshot)';
  end if;
  if new.day_count is distinct from old.day_count then
    raise exception 'menus.day_count is immutable after create';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'menus.user_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists menus_freeze_snapshot_columns_trg on public.menus;
create trigger menus_freeze_snapshot_columns_trg
  before update on public.menus
  for each row
  execute function public.menus_freeze_snapshot_columns();

-- Enforce day_index within parent day_count on insert/update.
create or replace function public.menu_slots_day_index_within_menu()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_day_count integer;
begin
  select day_count into v_day_count
  from public.menus
  where id = new.menu_id;

  if v_day_count is null then
    raise exception 'menu not found for slot';
  end if;

  if new.day_index < 1 or new.day_index > v_day_count then
    raise exception 'menu_slots.day_index must be between 1 and menus.day_count';
  end if;

  return new;
end;
$$;

drop trigger if exists menu_slots_day_index_within_menu_trg on public.menu_slots;
create trigger menu_slots_day_index_within_menu_trg
  before insert or update on public.menu_slots
  for each row
  execute function public.menu_slots_day_index_within_menu();
