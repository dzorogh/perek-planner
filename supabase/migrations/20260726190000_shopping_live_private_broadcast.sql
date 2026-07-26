-- Public DB broadcasts were inserted into realtime.messages but never delivered
-- to WebSocket clients. Match the documented path: private send + private channel.
-- RLS on realtime.messages already allows authenticated shopping-live:* topics.

create or replace function public.broadcast_shopping_list_selection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'menuId', NEW.menu_id,
        'selfId', 'db',
        'keysLen', coalesce(cardinality(NEW.curated_product_keys), 0)
      ),
      'shopping-selection-changed',
      'shopping-live:' || NEW.menu_id::text,
      true -- private; must match client config.private
    );
  exception when others then
    raise warning 'broadcast_shopping_list_selection failed: %', sqlerrm;
  end;
  return NEW;
end;
$$;

comment on function public.broadcast_shopping_list_selection() is
  'Private Broadcast when curated keys change (matches private shopping-live channel).';

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
    true -- private
  );

  return jsonb_build_object(
    'ok', true,
    'topic', topic,
    'private', true,
    'event', 'shopping-selection-changed'
  );
end;
$$;
