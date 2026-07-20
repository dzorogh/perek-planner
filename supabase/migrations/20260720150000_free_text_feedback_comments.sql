-- Free-text comments on refusals and dislike ratings (required for dislike).

-- 1) recipe_refusals.comment
alter table public.recipe_refusals
  add column if not exists comment text null;

comment on column public.recipe_refusals.comment is
  'Operator free-text reason (e.g. «Не люблю тушёную капусту»). Fed into AI invent/assign prompts.';

alter table public.recipe_refusals
  drop constraint if exists recipe_refusals_comment_nonempty;
alter table public.recipe_refusals
  add constraint recipe_refusals_comment_nonempty
  check (comment is null or char_length(trim(comment)) > 0);

drop policy if exists "recipe_refusals_update_own" on public.recipe_refusals;
create policy "recipe_refusals_update_own"
  on public.recipe_refusals for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update on table public.recipe_refusals to authenticated;

-- 2) recipe_ratings.reason → free text (was enum taxonomy)
alter table public.recipe_ratings
  drop constraint if exists recipe_ratings_reason_check;

-- Migrate old taxonomy codes to Russian labels
update public.recipe_ratings
set reason = case reason
  when 'too_hard' then 'Слишком сложно'
  when 'not_tasty' then 'Не вкусно'
  when 'too_long' then 'Слишком долго'
  when 'other' then 'Другое'
  else reason
end
where reason in ('too_hard', 'not_tasty', 'too_long', 'other');

-- Existing dislikes without reason get a placeholder so constraint can apply
update public.recipe_ratings
set reason = 'Без комментария (старая оценка)'
where rating = 'dislike'
  and (reason is null or char_length(trim(reason)) = 0);

alter table public.recipe_ratings
  drop constraint if exists recipe_ratings_dislike_needs_comment;
alter table public.recipe_ratings
  add constraint recipe_ratings_dislike_needs_comment
  check (
    rating <> 'dislike'
    or (reason is not null and char_length(trim(reason)) > 0)
  );

comment on column public.recipe_ratings.reason is
  'Free-text comment. Required when rating=dislike; ignored for like.';

-- 3) snack_ratings.reason → free text
alter table public.snack_ratings
  drop constraint if exists snack_ratings_reason_check;

update public.snack_ratings
set reason = case reason
  when 'too_hard' then 'Слишком сложно'
  when 'not_tasty' then 'Не вкусно'
  when 'too_long' then 'Слишком долго'
  when 'other' then 'Другое'
  else reason
end
where reason in ('too_hard', 'not_tasty', 'too_long', 'other');

update public.snack_ratings
set reason = 'Без комментария (старая оценка)'
where rating = 'dislike'
  and (reason is null or char_length(trim(reason)) = 0);

alter table public.snack_ratings
  drop constraint if exists snack_ratings_dislike_needs_comment;
alter table public.snack_ratings
  add constraint snack_ratings_dislike_needs_comment
  check (
    rating <> 'dislike'
    or (reason is not null and char_length(trim(reason)) > 0)
  );

comment on column public.snack_ratings.reason is
  'Free-text comment. Required when rating=dislike; ignored for like.';
