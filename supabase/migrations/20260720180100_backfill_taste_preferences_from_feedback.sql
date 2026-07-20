-- Copy existing refusal / dislike comments into taste_preferences (Settings bans).

insert into public.taste_preferences (user_id, kind, body)
select
  src.user_id,
  'ban',
  src.body
from (
  select
    r.user_id,
    left(
      case
        when nullif(btrim(rec.name), '') is not null
          then btrim(rec.name) || ': ' || btrim(r.comment)
        else btrim(r.comment)
      end,
      500
    ) as body
  from public.recipe_refusals r
  left join public.recipes rec on rec.id = r.recipe_id
  where r.comment is not null
    and char_length(btrim(r.comment)) >= 3

  union all

  select
    rr.user_id,
    left(
      case
        when nullif(btrim(rec.name), '') is not null
          then btrim(rec.name) || ': ' || btrim(rr.reason)
        else btrim(rr.reason)
      end,
      500
    ) as body
  from public.recipe_ratings rr
  left join public.recipes rec on rec.id = rr.recipe_id
  where rr.rating = 'dislike'
    and rr.reason is not null
    and char_length(btrim(rr.reason)) >= 3

  union all

  select
    sr.user_id,
    left(
      case
        when nullif(btrim(sr.label), '') is not null
          then btrim(sr.label) || ': ' || btrim(sr.reason)
        else btrim(sr.reason)
      end,
      500
    ) as body
  from public.snack_ratings sr
  where sr.rating = 'dislike'
    and sr.reason is not null
    and char_length(btrim(sr.reason)) >= 3
) src
where char_length(btrim(src.body)) >= 3
  and not exists (
    select 1
    from public.taste_preferences tp
    where tp.user_id = src.user_id
      and tp.kind = 'ban'
      and tp.body = src.body
  );
