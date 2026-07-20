-- Chunk 3 infra review: snack day_index vs menu length + companion slot invariants.

-- ---------------------------------------------------------------------------
-- menu_snacks.day_index must stay within menus.day_count (mirror menu_slots).
-- ---------------------------------------------------------------------------
create or replace function public.menu_snacks_day_index_within_menu()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_day_count integer;
begin
  select day_count into v_day_count
  from public.menus
  where id = new.menu_id;

  if v_day_count is null then
    raise exception 'menu not found for snack';
  end if;

  if new.day_index < 1 or new.day_index > v_day_count then
    raise exception 'menu_snacks.day_index must be between 1 and menus.day_count';
  end if;

  return new;
end;
$$;

drop trigger if exists menu_snacks_day_index_within_menu_trg on public.menu_snacks;
create trigger menu_snacks_day_index_within_menu_trg
  before insert or update on public.menu_snacks
  for each row
  execute function public.menu_snacks_day_index_within_menu();

-- ---------------------------------------------------------------------------
-- Companion only with a main, and only on lunch / dinner / late_dinner.
-- ---------------------------------------------------------------------------
alter table public.menu_slots
  drop constraint if exists menu_slots_companion_ne_main;

alter table public.menu_slots
  drop constraint if exists menu_slots_companion_requires_main;

alter table public.menu_slots
  drop constraint if exists menu_slots_companion_meal_allowed;

alter table public.menu_slots
  add constraint menu_slots_companion_ne_main
  check (companion_recipe_id is null or companion_recipe_id <> recipe_id);

alter table public.menu_slots
  add constraint menu_slots_companion_requires_main
  check (companion_recipe_id is null or recipe_id is not null);

alter table public.menu_slots
  add constraint menu_slots_companion_meal_allowed
  check (
    companion_recipe_id is null
    or meal in ('lunch', 'dinner', 'late_dinner')
  );
