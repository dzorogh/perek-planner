-- Pair planning reuses the same snack label on two days (1–2 and 3–4).
-- Drop legacy unique(menu_id, label); uniqueness is per day via menu_snacks_menu_day_unique.

alter table public.menu_snacks
  drop constraint if exists menu_snacks_menu_id_label_key;
