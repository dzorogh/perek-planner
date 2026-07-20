-- Per-serving price + KBJU on free-text snacks (nullable; omit in UI when unknown).

alter table public.menu_snacks
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

comment on column public.menu_snacks.price_cents_per_serving is
  'Estimated grocery cost per 1 adult snack serving in kopecks; null when unknown.';
comment on column public.menu_snacks.calories_kcal_per_serving is
  'Estimated kcal per 1 adult snack serving; null when unknown.';
comment on column public.menu_snacks.protein_g_per_serving is
  'Estimated protein grams per 1 adult snack serving; null when unknown.';
comment on column public.menu_snacks.fat_g_per_serving is
  'Estimated fat grams per 1 adult snack serving; null when unknown.';
comment on column public.menu_snacks.carbs_g_per_serving is
  'Estimated carbs grams per 1 adult snack serving; null when unknown.';
