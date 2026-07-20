-- Story 2.3: Refusal + Rating tables for suggestion hard-suppress / weighting (AD-4).
-- Write UI comes later (2.6 Refusal CTA, Epic 4 Rating). Tables exist so suppress path is real.

create table if not exists public.recipe_refusals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

comment on table public.recipe_refusals is
  'Operator Refusal of a Recipe — hard-suppressed from AI suggestions (AD-4, FR8). Written by Story 2.6 UI.';

create index if not exists recipe_refusals_user_idx
  on public.recipe_refusals (user_id);

create table if not exists public.recipe_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- like / medium / dislike — dislike is hard-suppressed (AD-4).
  rating text not null check (rating in ('dislike', 'medium', 'like')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

comment on table public.recipe_ratings is
  'Operator Rating of a Recipe. dislike hard-suppress; like weighted higher in long-idle ranking (Story 2.3). Write UI Epic 4.';

comment on column public.recipe_ratings.rating is
  'dislike = never suggest; medium = neutral; like = prefer among long-idle candidates.';

create index if not exists recipe_ratings_user_idx
  on public.recipe_ratings (user_id);

-- RLS -----------------------------------------------------------------------

alter table public.recipe_refusals enable row level security;
alter table public.recipe_ratings enable row level security;

create policy "recipe_refusals_select_own"
  on public.recipe_refusals for select to authenticated
  using (user_id = auth.uid());

create policy "recipe_refusals_insert_own"
  on public.recipe_refusals for insert to authenticated
  with check (user_id = auth.uid());

create policy "recipe_refusals_delete_own"
  on public.recipe_refusals for delete to authenticated
  using (user_id = auth.uid());

create policy "recipe_ratings_select_own"
  on public.recipe_ratings for select to authenticated
  using (user_id = auth.uid());

create policy "recipe_ratings_insert_own"
  on public.recipe_ratings for insert to authenticated
  with check (user_id = auth.uid());

create policy "recipe_ratings_update_own"
  on public.recipe_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recipe_ratings_delete_own"
  on public.recipe_ratings for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.recipe_refusals from anon, public;
revoke all on table public.recipe_ratings from anon, public;
grant select, insert, delete on table public.recipe_refusals to authenticated;
grant select, insert, update, delete on table public.recipe_ratings to authenticated;
