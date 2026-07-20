-- AI invent-then-persist: authenticated may add shared library recipes + ingredients.
-- Seed recipes get real body_text (not placeholder).

grant insert, delete on table public.recipes to authenticated;
grant insert, delete on table public.critical_ingredients to authenticated;

drop policy if exists "recipes_insert_authenticated" on public.recipes;
create policy "recipes_insert_authenticated"
  on public.recipes
  for insert
  to authenticated
  with check (true);

drop policy if exists "recipes_delete_authenticated" on public.recipes;
create policy "recipes_delete_authenticated"
  on public.recipes
  for delete
  to authenticated
  using (true);

drop policy if exists "critical_ingredients_insert_authenticated"
  on public.critical_ingredients;
create policy "critical_ingredients_insert_authenticated"
  on public.critical_ingredients
  for insert
  to authenticated
  with check (true);

drop policy if exists "critical_ingredients_delete_authenticated"
  on public.critical_ingredients;
create policy "critical_ingredients_delete_authenticated"
  on public.critical_ingredients
  for delete
  to authenticated
  using (true);

comment on table public.recipes is
  'Shared recipe library. Seeded + OpenRouter invent-then-persist (AD-4). '
  'Assignment still uses library ids only after invent; Refusal/dislike hard-suppress.';

update public.recipes
set
  body_text = $chicken$
1. Курицу нарежьте крупными кусками, посолите.
2. Обжарьте на сковороде до лёгкой корочки, переложите в кастрюлю.
3. Добавьте промытую гречку, залейте водой так, чтобы крупа была покрыта на 1–2 см.
4. Доведите до кипения, уменьшите огонь и тушите под крышкой 25–30 минут, пока гречка не станет мягкой.
5. Дайте постоять 5 минут и подавайте.
$chicken$,
  updated_at = now()
where id = 'b2000000-0000-4000-8000-000000000001';

update public.recipes
set
  body_text = $omelet$
1. Яйца взбейте вилкой с щепоткой соли.
2. Зелень мелко нарежьте и вмешайте в яичную смесь.
3. Разогрейте сковороду с небольшим количеством масла.
4. Вылейте смесь, жарьте на среднем огне под крышкой 3–5 минут до схватывания.
5. Сложите пополам или подавайте целиком, пока горячий.
$omelet$,
  updated_at = now()
where id = 'b2000000-0000-4000-8000-000000000002';
