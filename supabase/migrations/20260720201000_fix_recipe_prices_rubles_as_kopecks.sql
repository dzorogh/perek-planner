-- AI invent often wrote rubles into price_cents_per_serving (e.g. 200 → shown as 2 ₽).
-- Values under 5000 cannot be realistic kopecks for a cooked serving (≥ ~50 ₽);
-- treat them as rubles and convert to kopecks. Seeded rows (6000, 18000, …) stay.

update public.recipes
set price_cents_per_serving = price_cents_per_serving * 100
where price_cents_per_serving is not null
  and price_cents_per_serving > 0
  and price_cents_per_serving < 5000;
