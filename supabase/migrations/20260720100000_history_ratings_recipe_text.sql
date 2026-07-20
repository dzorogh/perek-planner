-- Epic 4: recipe text, rating reasons, snack ratings.

alter table public.recipes
  add column if not exists body_text text not null default '';

comment on column public.recipes.body_text is
  'Full Recipe text for recipe-text-panel (FR22). Empty string when unknown — never invent content.';

update public.recipes
set body_text = case
  when body_text = '' then
    'Текст рецепта пока не заполнен. Добавьте шаги в каталоге рецептов позже.'
  else body_text
end
where body_text = '';

alter table public.recipe_ratings
  add column if not exists reason text null
    check (
      reason is null
      or reason in ('too_hard', 'not_tasty', 'too_long', 'other')
    );

comment on column public.recipe_ratings.reason is
  'v1 reasons: too_hard | not_tasty | too_long | other (FR9).';

create table if not exists public.snack_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  rating text not null check (rating in ('dislike', 'medium', 'like')),
  reason text null
    check (
      reason is null
      or reason in ('too_hard', 'not_tasty', 'too_long', 'other')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

comment on table public.snack_ratings is
  'Operator Rating of a Snack Product. dislike hard-suppresses snack search (FR9).';

create index if not exists snack_ratings_user_idx
  on public.snack_ratings (user_id);

alter table public.snack_ratings enable row level security;

create policy "snack_ratings_select_own"
  on public.snack_ratings for select to authenticated
  using (user_id = auth.uid());

create policy "snack_ratings_insert_own"
  on public.snack_ratings for insert to authenticated
  with check (user_id = auth.uid());

create policy "snack_ratings_update_own"
  on public.snack_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "snack_ratings_delete_own"
  on public.snack_ratings for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.snack_ratings from anon, public;
grant select, insert, update, delete on table public.snack_ratings to authenticated;
