-- Deferred-work hardening: taste_preferences row cap + critical_ingredients UPDATE
-- + clear legacy placeholder recipe bodies.

-- ---------------------------------------------------------------------------
-- Cap taste_preferences at 60 rows per user (matches MAX_TASTE_PREFERENCES).
-- ---------------------------------------------------------------------------
create or replace function public.taste_preferences_enforce_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.taste_preferences
  where user_id = new.user_id;

  if v_count >= 60 then
    raise exception 'taste_preferences cap (60) reached for user';
  end if;

  return new;
end;
$$;

drop trigger if exists taste_preferences_enforce_cap_trg on public.taste_preferences;
create trigger taste_preferences_enforce_cap_trg
  before insert on public.taste_preferences
  for each row
  execute function public.taste_preferences_enforce_cap();

-- ---------------------------------------------------------------------------
-- Allow authenticated UPDATE on critical_ingredients (invent/edit path).
-- ---------------------------------------------------------------------------
drop policy if exists "critical_ingredients_update_authenticated"
  on public.critical_ingredients;
create policy "critical_ingredients_update_authenticated"
  on public.critical_ingredients for update to authenticated
  using (true)
  with check (true);

grant update on table public.critical_ingredients to authenticated;

-- ---------------------------------------------------------------------------
-- Drop legacy placeholder body_text so UI shows empty instead of fake copy.
-- ---------------------------------------------------------------------------
update public.recipes
set body_text = ''
where body_text like 'Текст рецепта пока не заполнен%';
