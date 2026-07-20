-- Story 2.2 review: atomic replace RPC + consistency checks on checked_matches.

-- Consistency: recipe_id matches ingredient; slot same menu; product same store.
create or replace function public.checked_matches_enforce_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ing_recipe uuid;
  v_menu_store uuid;
  v_product_store uuid;
  v_slot_menu uuid;
begin
  select recipe_id into v_ing_recipe
  from public.critical_ingredients
  where id = new.critical_ingredient_id;

  if v_ing_recipe is null then
    raise exception 'critical_ingredient not found';
  end if;

  if new.recipe_id is distinct from v_ing_recipe then
    raise exception 'checked_matches.recipe_id must match critical_ingredients.recipe_id';
  end if;

  select store_id into v_menu_store
  from public.menus
  where id = new.menu_id;

  if v_menu_store is null then
    raise exception 'menu not found for checked_match';
  end if;

  select store_id into v_product_store
  from public.products
  where id = new.product_id;

  if v_product_store is null then
    raise exception 'product not found for checked_match';
  end if;

  if v_product_store is distinct from v_menu_store then
    raise exception 'checked_matches.product must belong to menus.store_id snapshot';
  end if;

  if new.menu_slot_id is not null then
    select menu_id into v_slot_menu
    from public.menu_slots
    where id = new.menu_slot_id;

    if v_slot_menu is null or v_slot_menu is distinct from new.menu_id then
      raise exception 'checked_matches.menu_slot_id must belong to the same menu';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists checked_matches_enforce_consistency_trg on public.checked_matches;
create trigger checked_matches_enforce_consistency_trg
  before insert or update on public.checked_matches
  for each row
  execute function public.checked_matches_enforce_consistency();

-- Atomic replace for (menu_id, recipe_id).
create or replace function public.replace_checked_matches(
  p_menu_id uuid,
  p_recipe_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  r jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select user_id into v_owner from public.menus where id = p_menu_id;
  if v_owner is null or v_owner is distinct from v_user then
    raise exception 'menu not found or not owned';
  end if;

  delete from public.checked_matches
  where menu_id = p_menu_id and recipe_id = p_recipe_id;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return;
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.checked_matches (
      menu_id,
      recipe_id,
      critical_ingredient_id,
      product_id,
      menu_slot_id
    ) values (
      p_menu_id,
      p_recipe_id,
      (r->>'critical_ingredient_id')::uuid,
      (r->>'product_id')::uuid,
      null
    );
  end loop;
end;
$$;

comment on function public.replace_checked_matches(uuid, uuid, jsonb) is
  'Story 2.2: atomically replace CheckedMatch rows for a Menu×Recipe.';

revoke all on function public.replace_checked_matches(uuid, uuid, jsonb) from public;
revoke all on function public.replace_checked_matches(uuid, uuid, jsonb) from anon;
grant execute on function public.replace_checked_matches(uuid, uuid, jsonb) to authenticated;
