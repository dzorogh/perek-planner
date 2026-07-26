-- Remove temporary diagnosis RPCs from shopping live-sync debugging.

drop function if exists public.debug_shopping_live_ping(uuid);
drop function if exists public.debug_shopping_live_touch(uuid);
