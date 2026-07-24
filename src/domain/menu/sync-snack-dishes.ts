/**
 * Best-effort dual-write of Перекус labels into menu_slot_dishes (Story 6.1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ensureSnackSlots,
  upsertSnackDish,
} from "@/domain/menu/slot-dishes";

export async function syncSnackDishesForDays(
  supabase: SupabaseClient,
  menuId: string,
  dayIndexes: readonly number[],
  label: string,
): Promise<void> {
  const { data: menuRow } = await supabase
    .from("menus")
    .select("day_count, default_servings_per_meal")
    .eq("id", menuId)
    .maybeSingle();
  const dayCount =
    typeof menuRow?.day_count === "number" ? menuRow.day_count : 0;
  const servings =
    typeof menuRow?.default_servings_per_meal === "number"
      ? menuRow.default_servings_per_meal
      : 2;
  if (dayCount < 1) return;

  const byDay = await ensureSnackSlots(supabase, menuId, dayCount, servings);
  for (const dayIndex of dayIndexes) {
    const slotId = byDay.get(dayIndex);
    if (slotId) await upsertSnackDish(supabase, slotId, label);
  }
}

export async function syncSnackDishesFromRows(
  supabase: SupabaseClient,
  menuId: string,
  dayCount: number,
  rows: ReadonlyArray<{ day_index: number; label: string }>,
): Promise<void> {
  const { data: menuRow } = await supabase
    .from("menus")
    .select("default_servings_per_meal")
    .eq("id", menuId)
    .maybeSingle();
  const servings =
    typeof menuRow?.default_servings_per_meal === "number"
      ? menuRow.default_servings_per_meal
      : 2;
  const byDay = await ensureSnackSlots(supabase, menuId, dayCount, servings);
  for (const row of rows) {
    const slotId = byDay.get(row.day_index);
    if (slotId) await upsertSnackDish(supabase, slotId, row.label);
  }
}
