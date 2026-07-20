-- Close deferred: keep rating updated_at honest on write; lock down event-trigger helper RPC.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipe_ratings_set_updated_at on public.recipe_ratings;
create trigger recipe_ratings_set_updated_at
  before update on public.recipe_ratings
  for each row
  execute function public.set_updated_at();

drop trigger if exists snack_ratings_set_updated_at on public.snack_ratings;
create trigger snack_ratings_set_updated_at
  before update on public.snack_ratings
  for each row
  execute function public.set_updated_at();

-- Event-trigger helper must not be callable via PostgREST as anon/authenticated.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
