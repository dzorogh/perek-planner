-- Per-serving price + KBJU on recipes (nullable; never fabricate in UI).

alter table public.recipes
  add column if not exists price_cents_per_serving integer null
    check (price_cents_per_serving is null or price_cents_per_serving >= 0),
  add column if not exists calories_kcal_per_serving integer null
    check (calories_kcal_per_serving is null or calories_kcal_per_serving >= 0),
  add column if not exists protein_g_per_serving numeric null
    check (protein_g_per_serving is null or protein_g_per_serving >= 0),
  add column if not exists fat_g_per_serving numeric null
    check (fat_g_per_serving is null or fat_g_per_serving >= 0),
  add column if not exists carbs_g_per_serving numeric null
    check (carbs_g_per_serving is null or carbs_g_per_serving >= 0);

comment on column public.recipes.price_cents_per_serving is
  'Estimated ingredient cost per 1 adult serving in kopecks; null when unknown.';
comment on column public.recipes.calories_kcal_per_serving is
  'Estimated kcal per 1 adult serving; null when unknown.';
comment on column public.recipes.protein_g_per_serving is
  'Estimated protein grams per 1 adult serving; null when unknown.';
comment on column public.recipes.fat_g_per_serving is
  'Estimated fat grams per 1 adult serving; null when unknown.';
comment on column public.recipes.carbs_g_per_serving is
  'Estimated carbs grams per 1 adult serving; null when unknown.';

-- Seed library recipes with realistic home-cooking estimates.
update public.recipes
set
  price_cents_per_serving = 18000,
  calories_kcal_per_serving = 450,
  protein_g_per_serving = 35,
  fat_g_per_serving = 15,
  carbs_g_per_serving = 40
where id = 'b2000000-0000-4000-8000-000000000001';

update public.recipes
set
  price_cents_per_serving = 6000,
  calories_kcal_per_serving = 220,
  protein_g_per_serving = 14,
  fat_g_per_serving = 16,
  carbs_g_per_serving = 3
where id = 'b2000000-0000-4000-8000-000000000002';
