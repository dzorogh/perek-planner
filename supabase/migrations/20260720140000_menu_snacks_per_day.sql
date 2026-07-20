-- One generated snack per menu day; replace in place (no manual-add primary path).

alter table public.menu_snacks
  add column if not exists day_index integer;

-- Backfill: assign sequential day_index within each menu
with ranked as (
  select
    id,
    row_number() over (partition by menu_id order by created_at, id) as rn
  from public.menu_snacks
  where day_index is null
)
update public.menu_snacks s
set day_index = r.rn
from ranked r
where s.id = r.id;

-- Drop snacks that no longer fit day_count (edge leftovers)
delete from public.menu_snacks ms
using public.menus m
where ms.menu_id = m.id
  and (ms.day_index is null or ms.day_index < 1 or ms.day_index > m.day_count);

alter table public.menu_snacks
  alter column day_index set not null;

alter table public.menu_snacks
  drop constraint if exists menu_snacks_day_index_check;
alter table public.menu_snacks
  add constraint menu_snacks_day_index_check
  check (day_index >= 1 and day_index <= 4);

alter table public.menu_snacks
  drop constraint if exists menu_snacks_menu_day_unique;
alter table public.menu_snacks
  add constraint menu_snacks_menu_day_unique unique (menu_id, day_index);

comment on column public.menu_snacks.day_index is
  'Day within the Menu (1..day_count). One snack slot per day; generated with the menu.';

drop policy if exists "menu_snacks_update_own" on public.menu_snacks;
create policy "menu_snacks_update_own"
  on public.menu_snacks for update to authenticated
  using (
    exists (
      select 1 from public.menus m
      where m.id = menu_snacks.menu_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.menus m
      where m.id = menu_snacks.menu_id and m.user_id = auth.uid()
    )
  );

grant update on table public.menu_snacks to authenticated;
