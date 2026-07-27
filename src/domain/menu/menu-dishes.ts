/**
 * Persist helpers for menu_dishes (universal Menu dish lines).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { MealSlot } from "@/domain/menu/constants";
import {
  isTemplateMeal,
  rolesForMeal,
  sortOrderForRole,
  type PlateRole,
} from "@/domain/menu/meal-templates";

export type MenuDishWrite =
  | { plateRole: PlateRole; recipeId: string; snackLabel?: never }
  | { plateRole: "snack"; snackLabel: string; recipeId?: never };

export type SnackDishDraft = {
  label: string;
  priceCentsPerServing: number | null;
  caloriesKcalPerServing: number | null;
  proteinGPerServing: number | null;
  fatGPerServing: number | null;
  carbsGPerServing: number | null;
};

/**
 * Upsert full cookable dish set for a slot; delete stale template roles not
 * in the write set. Never snack. Upsert before delete (no wipe-then-fail).
 */
export async function replaceSlotDishes(
  supabase: SupabaseClient,
  slotId: string,
  meal: MealSlot,
  dishes: ReadonlyArray<Extract<MenuDishWrite, { recipeId: string }>>,
): Promise<boolean> {
  if (!isTemplateMeal(meal) || meal === "snack") return false;
  const template = rolesForMeal(meal);
  const templateSet = new Set(template);
  const writes = dishes.filter(
    (w) => w.plateRole !== "snack" && templateSet.has(w.plateRole) && w.recipeId,
  );

  // Invalid roles that all filter out must not wipe the slot.
  if (writes.length === 0 && dishes.length > 0) {
    return false;
  }

  if (writes.length > 0) {
    // Content change clears cook feedback — never inherit prepared/rating.
    const rows = writes.map((w) => ({
      menu_slot_id: slotId,
      plate_role: w.plateRole,
      recipe_id: w.recipeId,
      snack_label: null as string | null,
      sort_order: sortOrderForRole(meal, w.plateRole),
      prepared: false,
      rating: null as string | null,
      updated_at: new Date().toISOString(),
    }));
    const { error: insError } = await supabase
      .from("menu_dishes")
      .upsert(rows, { onConflict: "menu_slot_id,plate_role" });
    if (insError) return false;
  }

  const keep = new Set(writes.map((w) => w.plateRole));
  const stale = template.filter((r) => !keep.has(r));
  if (stale.length > 0) {
    const { error: delError } = await supabase
      .from("menu_dishes")
      .delete()
      .eq("menu_slot_id", slotId)
      .in("plate_role", stale);
    if (delError) return false;
  }
  return true;
}

/** Upsert snack label (+ optional nutrition) on a snack meal slot. */
export async function upsertSnackDish(
  supabase: SupabaseClient,
  slotId: string,
  snackLabel: string,
  nutrition?: Partial<{
    price_cents_per_serving: number | null;
    calories_kcal_per_serving: number | null;
    protein_g_per_serving: number | null;
    fat_g_per_serving: number | null;
    carbs_g_per_serving: number | null;
  }>,
): Promise<boolean> {
  const label = snackLabel.trim();
  if (!label) return false;

  const { error } = await supabase.from("menu_dishes").upsert(
    {
      menu_slot_id: slotId,
      plate_role: "snack",
      recipe_id: null,
      snack_label: label,
      sort_order: 0,
      prepared: false,
      rating: null,
      price_cents_per_serving: nutrition?.price_cents_per_serving ?? null,
      calories_kcal_per_serving: nutrition?.calories_kcal_per_serving ?? null,
      protein_g_per_serving: nutrition?.protein_g_per_serving ?? null,
      fat_g_per_serving: nutrition?.fat_g_per_serving ?? null,
      carbs_g_per_serving: nutrition?.carbs_g_per_serving ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "menu_slot_id,plate_role" },
  );

  return !error;
}

export function snackDraftNutrition(draft: SnackDishDraft) {
  return {
    price_cents_per_serving: draft.priceCentsPerServing,
    calories_kcal_per_serving: draft.caloriesKcalPerServing,
    protein_g_per_serving: draft.proteinGPerServing,
    fat_g_per_serving: draft.fatGPerServing,
    carbs_g_per_serving: draft.carbsGPerServing,
  };
}

/** Ensure snack slots exist for each day; return slot ids by day_index. */
export async function ensureSnackSlots(
  supabase: SupabaseClient,
  menuId: string,
  dayCount: number,
  servings: number,
): Promise<Map<number, string>> {
  const byDay = new Map<number, string>();

  const { data: existing } = await supabase
    .from("menu_slots")
    .select("id, day_index")
    .eq("menu_id", menuId)
    .eq("meal", "snack");

  for (const row of existing ?? []) {
    byDay.set(row.day_index, row.id);
  }

  for (let day = 1; day <= dayCount; day += 1) {
    if (byDay.has(day)) continue;
    const { data, error } = await supabase
      .from("menu_slots")
      .insert({
        menu_id: menuId,
        day_index: day,
        meal: "snack",
        recipe_id: null,
        servings,
      })
      .select("id")
      .maybeSingle();
    if (!error && data?.id) {
      byDay.set(day, data.id);
      continue;
    }
    // Race / unique conflict — re-select existing row for this day.
    const { data: again } = await supabase
      .from("menu_slots")
      .select("id")
      .eq("menu_id", menuId)
      .eq("meal", "snack")
      .eq("day_index", day)
      .maybeSingle();
    if (again?.id) byDay.set(day, again.id);
  }

  return byDay;
}

/** Replace all snack dishes for a menu from day→draft map. */
export async function replaceMenuSnackDishes(
  supabase: SupabaseClient,
  menuId: string,
  dayCount: number,
  servings: number,
  byDay: ReadonlyMap<number, SnackDishDraft>,
): Promise<boolean> {
  const slots = await ensureSnackSlots(supabase, menuId, dayCount, servings);
  const slotIds = [...slots.values()];
  if (slotIds.length > 0) {
    const { error: delError } = await supabase
      .from("menu_dishes")
      .delete()
      .in("menu_slot_id", slotIds)
      .eq("plate_role", "snack");
    if (delError) return false;
  }

  for (const [dayIndex, draft] of byDay) {
    const slotId = slots.get(dayIndex);
    if (!slotId) return false;
    const ok = await upsertSnackDish(
      supabase,
      slotId,
      draft.label,
      snackDraftNutrition(draft),
    );
    if (!ok) return false;
  }
  return true;
}
