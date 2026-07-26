-- Private Broadcast for shopping-list live sync.
-- Client-to-client public Broadcast was not delivered; DB trigger + private topic.

create policy "authenticated_receive_shopping_live_broadcast"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.topic()) like 'shopping-live:%'
    and realtime.messages.extension = 'broadcast'
  );

create policy "authenticated_send_shopping_live_broadcast"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (select realtime.topic()) like 'shopping-live:%'
    and realtime.messages.extension = 'broadcast'
  );

create or replace function public.broadcast_shopping_list_selection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'menuId', NEW.menu_id,
      'selfId', 'db',
      'keysLen', coalesce(cardinality(NEW.curated_product_keys), 0)
    ),
    'shopping-selection-changed',
    'shopping-live:' || NEW.menu_id::text,
    true -- private channel (must match client config.private)
  );
  return NEW;
end;
$$;

comment on function public.broadcast_shopping_list_selection() is
  'Notify shopping-live private channel when curated keys change.';

drop trigger if exists shopping_lists_broadcast_selection on public.shopping_lists;

create trigger shopping_lists_broadcast_selection
  after insert or update of curated_product_keys
  on public.shopping_lists
  for each row
  execute function public.broadcast_shopping_list_selection();
