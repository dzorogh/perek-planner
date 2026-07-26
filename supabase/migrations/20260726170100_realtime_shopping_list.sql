-- Realtime for curated shopping cart (listen-only client sync).
-- FULL identity: postgres_changes filter is menu_id (not PK); DEFAULT
-- replica identity omits menu_id on UPDATE/DELETE and drops filtered events.

alter table public.shopping_lists replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_lists'
  ) then
    alter publication supabase_realtime add table public.shopping_lists;
  end if;
end $$;
