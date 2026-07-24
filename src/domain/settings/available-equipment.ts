import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  normalizeEquipmentList,
  type EquipmentId,
} from "@/domain/menu/equipment";

export async function loadAvailableEquipment(
  supabase: SupabaseClient,
  userId: string,
): Promise<EquipmentId[]> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("available_equipment")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return [...DEFAULT_AVAILABLE_EQUIPMENT];
  }

  return (
    normalizeEquipmentList(data.available_equipment as string[]) ?? [
      ...DEFAULT_AVAILABLE_EQUIPMENT,
    ]
  );
}

/** Best-effort upsert; returns false on failure (do not block menu create). */
export async function upsertAvailableEquipment(
  supabase: SupabaseClient,
  userId: string,
  equipment: readonly EquipmentId[],
): Promise<boolean> {
  const normalized = normalizeEquipmentList(equipment);
  if (!normalized) return false;

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      available_equipment: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return !error;
}
