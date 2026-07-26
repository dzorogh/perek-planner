-- UPDATE must keep ownership of the target menu (prevent menu_id hijack via RLS).

drop policy if exists shopping_lists_update_own on public.shopping_lists;

create policy shopping_lists_update_own
  on public.shopping_lists for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.menus m
      where m.id = menu_id
        and m.user_id = (select auth.uid())
    )
  );
