-- FULL identity so postgres_changes filter menu_id=eq.* matches UPDATE/DELETE.
-- DEFAULT replica identity only ships PK columns; menu_id filters then drop events.

alter table public.shopping_lists replica identity full;
