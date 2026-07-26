-- Realtime CDC on shopping_lists never delivered with EXISTS(menus…) RLS.
-- Denormalize owner user_id (same pattern as menus) so SELECT policy is direct.
-- Drop unused realtime.messages policies from the abandoned private-broadcast path.

alter table public.shopping_lists
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.shopping_lists sl
set user_id = m.user_id
from public.menus m
where m.id = sl.menu_id
  and sl.user_id is null;

alter table public.shopping_lists
  alter column user_id set not null;

create index if not exists shopping_lists_user_id_idx
  on public.shopping_lists (user_id);

comment on column public.shopping_lists.user_id is
  'Menu owner; denormalized for RLS + Realtime postgres_changes.';

drop policy if exists shopping_lists_select_own on public.shopping_lists;
drop policy if exists shopping_lists_insert_own on public.shopping_lists;
drop policy if exists shopping_lists_update_own on public.shopping_lists;
drop policy if exists shopping_lists_delete_own on public.shopping_lists;

create policy shopping_lists_select_own
  on public.shopping_lists for select to authenticated
  using (user_id = (select auth.uid()));

create policy shopping_lists_insert_own
  on public.shopping_lists for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.menus m
      where m.id = menu_id and m.user_id = (select auth.uid())
    )
  );

create policy shopping_lists_update_own
  on public.shopping_lists for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy shopping_lists_delete_own
  on public.shopping_lists for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "authenticated_receive_shopping_live_broadcast"
  on realtime.messages;
drop policy if exists "authenticated_send_shopping_live_broadcast"
  on realtime.messages;
