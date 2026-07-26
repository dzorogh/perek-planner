-- Trigger was missing (function existed without bind). Restore + debug ping RPC.

drop trigger if exists shopping_lists_broadcast_selection on public.shopping_lists;

create trigger shopping_lists_broadcast_selection
  after insert or update of curated_product_keys
  on public.shopping_lists
  for each row
  execute function public.broadcast_shopping_list_selection();

create or replace function public.debug_shopping_live_ping(p_menu_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  topic text := 'shopping-live:' || p_menu_id::text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.menus m
    where m.id = p_menu_id
      and m.user_id = auth.uid()
  ) then
    raise exception 'menu not found';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'menuId', p_menu_id,
      'selfId', 'debug-rpc',
      'keysLen', -1,
      'ping', true,
      'at', timezone('utc', now())
    ),
    'shopping-selection-changed',
    topic,
    false
  );

  return jsonb_build_object(
    'ok', true,
    'topic', topic,
    'private', false,
    'event', 'shopping-selection-changed'
  );
end;
$$;

revoke all on function public.debug_shopping_live_ping(uuid) from public;
grant execute on function public.debug_shopping_live_ping(uuid) to authenticated;

create or replace function public.debug_shopping_live_touch(p_menu_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
  keys_len int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.menus m
    where m.id = p_menu_id
      and m.user_id = auth.uid()
  ) then
    raise exception 'menu not found';
  end if;

  update public.shopping_lists
  set
    curated_product_keys = curated_product_keys,
    updated_at = timezone('utc', now())
  where menu_id = p_menu_id
  returning id, cardinality(curated_product_keys)
  into updated_id, keys_len;

  if updated_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no shopping_lists row');
  end if;

  return jsonb_build_object(
    'ok', true,
    'shoppingListId', updated_id,
    'keysLen', coalesce(keys_len, 0),
    'note', 'trigger should have fired realtime.send'
  );
end;
$$;

revoke all on function public.debug_shopping_live_touch(uuid) from public;
grant execute on function public.debug_shopping_live_touch(uuid) to authenticated;
