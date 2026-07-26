-- Curated shopping cart: persist product keys on shopping_lists.
-- Quantities are always rebuilt from live SOURCE; drop obsolete snapshot lines.

alter table public.shopping_lists
  add column if not exists curated_product_keys text[] not null default '{}';

comment on column public.shopping_lists.curated_product_keys is
  'Selected shopping product_key values for this menu; quantities rebuilt from live dish SOURCE on hydrate.';

comment on table public.shopping_lists is
  'One curated shopping cart per Menu (selection keys only; no snapshot lines).';

-- Snapshot regenerate path removed; lines table no longer used.
drop table if exists public.shopping_list_lines;
