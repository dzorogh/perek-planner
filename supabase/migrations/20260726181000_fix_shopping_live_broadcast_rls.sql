-- Join authorization probes realtime.messages without a stable extension value.
-- SELECT by topic is enough to join + receive; INSERT still scoped to broadcast.

drop policy if exists "authenticated_receive_shopping_live_broadcast"
  on realtime.messages;

create policy "authenticated_receive_shopping_live_broadcast"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.topic()) like 'shopping-live:%'
  );

drop policy if exists "authenticated_send_shopping_live_broadcast"
  on realtime.messages;

create policy "authenticated_send_shopping_live_broadcast"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (select realtime.topic()) like 'shopping-live:%'
  );
