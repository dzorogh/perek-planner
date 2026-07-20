-- After rubles→kopecks backfill, AI restaurant-like estimates (600–2500 ₽/serving)
-- remain absurd for home cooking. Scale those down 10× (900 ₽ → 90 ₽).
-- Rows already in a sane band (< 500 ₽) and seeded kopecks are untouched.

update public.recipes
set price_cents_per_serving = price_cents_per_serving / 10
where price_cents_per_serving is not null
  and price_cents_per_serving >= 50000;
