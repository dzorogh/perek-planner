-- Persist invent plate_role so create/resuggest can pair mains with companions.
alter table public.recipes
  add column if not exists plate_role text
    check (plate_role is null or plate_role in ('main', 'companion'));

comment on column public.recipes.plate_role is
  'AI invent role: main (standalone) or companion (side/protein). Null for legacy/seed rows.';
