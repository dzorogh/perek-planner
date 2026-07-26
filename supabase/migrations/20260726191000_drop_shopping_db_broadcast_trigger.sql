-- DB realtime.send inserts into realtime.messages but is never delivered over
-- WebSocket on this project (public and private). Cart live-sync uses
-- client Broadcast after persist (same pattern as menu busy). Drop the dead path.

drop trigger if exists shopping_lists_broadcast_selection on public.shopping_lists;

drop function if exists public.broadcast_shopping_list_selection();

-- Keep debug RPCs for diagnosis, but ping now documents client-broadcast path.
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

  -- Still exercises realtime.send for infra checks; UI sync uses client Broadcast.
  perform realtime.send(
    jsonb_build_object(
      'menuId', p_menu_id,
      'selfId', 'debug-rpc',
      'keysLen', 0,
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
    'event', 'shopping-selection-changed',
    'note', 'DB send for infra only; product sync is client Broadcast'
  );
end;
$$;
