/**
 * Planning mutations (replace/modify/clear) are blocked when a Menu dish has
 * cook feedback. Refuse may still run; content upserts clear feedback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlateRole } from "@/domain/menu/meal-templates";

export function isPlanningLocked(
  prepared: boolean,
  rating: string | null | undefined,
): boolean {
  return prepared || (rating != null && rating !== "");
}

/** Load dish feedback for a slot role; null if no row. */
export async function loadDishPlanningState(
  supabase: SupabaseClient,
  slotId: string,
  plateRole: PlateRole,
): Promise<{ prepared: boolean; rating: string | null } | null> {
  const { data, error } = await supabase
    .from("menu_dishes")
    .select("prepared, rating")
    .eq("menu_slot_id", slotId)
    .eq("plate_role", plateRole)
    .maybeSingle();

  if (error || !data) return null;
  return {
    prepared: data.prepared === true,
    rating: typeof data.rating === "string" ? data.rating : null,
  };
}

const PLANNING_LOCKED_RU =
  "Блюдо отмечено как приготовленное или оценено — сначала снимите отметку.";

export async function assertDishPlanningUnlocked(
  supabase: SupabaseClient,
  slotId: string,
  plateRole: PlateRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await loadDishPlanningState(supabase, slotId, plateRole);
  if (!state) return { ok: true };
  if (isPlanningLocked(state.prepared, state.rating)) {
    return { ok: false, error: PLANNING_LOCKED_RU };
  }
  return { ok: true };
}

export async function assertDishPlanningUnlockedById(
  supabase: SupabaseClient,
  dishId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("menu_dishes")
    .select("prepared, rating")
    .eq("id", dishId)
    .maybeSingle();

  if (error || !data) return { ok: true };
  if (isPlanningLocked(data.prepared === true, data.rating)) {
    return { ok: false, error: PLANNING_LOCKED_RU };
  }
  return { ok: true };
}
