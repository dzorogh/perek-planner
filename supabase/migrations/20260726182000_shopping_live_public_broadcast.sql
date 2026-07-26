-- Public DB broadcast: private Realtime channels TIMED_OUT under load.
-- Clients listen on a public channel with the same topic.

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
    false -- public channel
  );
  return NEW;
end;
$$;

comment on function public.broadcast_shopping_list_selection() is
  'Public Broadcast when curated keys change (matches public shopping-live channel).';
