-- Operator free-text taste preferences (bans / wishes), editable in Settings.
-- Separate from recipe_refusals / ratings — not tied to a library recipe.

create table if not exists public.taste_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ban', 'wish')),
  body text not null
    check (
      char_length(btrim(body)) >= 3
      and char_length(body) <= 500
    ),
  created_at timestamptz not null default now()
);

comment on table public.taste_preferences is
  'Free-text operator bans and wishes for AI menu generation. Managed in Settings.';

comment on column public.taste_preferences.kind is
  'ban = hard constraint (never); wish = soft preference (prefer when possible).';

comment on column public.taste_preferences.body is
  'Operator note in Russian, e.g. «без гречки» or «чаще рыбу».';

create index if not exists taste_preferences_user_created_idx
  on public.taste_preferences (user_id, created_at desc);

alter table public.taste_preferences enable row level security;

create policy "taste_preferences_select_own"
  on public.taste_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "taste_preferences_insert_own"
  on public.taste_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "taste_preferences_update_own"
  on public.taste_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "taste_preferences_delete_own"
  on public.taste_preferences for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.taste_preferences from anon, public;
grant select, insert, update, delete on table public.taste_preferences to authenticated;
