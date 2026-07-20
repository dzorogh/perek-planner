-- Tighten Story 1.3 stores privileges: authenticated SELECT only.
-- Supabase default grants often include INSERT/UPDATE/DELETE for authenticated.

revoke all on table public.stores from anon;
revoke all on table public.stores from authenticated;
grant select on table public.stores to authenticated;
