-- Invent rollback may delete orphan recipes; seed real body_text for library recipes.

drop policy if exists "recipes_delete_authenticated" on public.recipes;

create policy "recipes_delete_authenticated"
  on public.recipes for delete to authenticated
  using (true);

grant delete on table public.recipes to authenticated;

update public.recipes
set body_text = case id
  when 'b2000000-0000-4000-8000-000000000001' then
    E'1. Курицу нарежьте кусками, обжарьте до румяной корочки.\n2. Добавьте лук и морковь, тушите 5 минут.\n3. Всыпьте промытую гречку, залейте водой, посолите.\n4. Тушите под крышкой 25–30 минут до готовности крупы.\n5. Дайте настояться 10 минут перед подачей.'
  when 'b2000000-0000-4000-8000-000000000002' then
    E'1. Взбейте яйца с щепоткой соли.\n2. Разогрейте сковороду с небольшим количеством масла.\n3. Вылейте яйца, готовьте на среднем огне до схватывания.\n4. Посыпьте свежей зеленью, сложите пополам и подайте.'
  else body_text
end
where id in (
  'b2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002'
);
