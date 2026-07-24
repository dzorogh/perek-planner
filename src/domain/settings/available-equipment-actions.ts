"use server";

import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { loadAvailableEquipment } from "@/domain/settings/available-equipment";
import { createClient } from "@/lib/supabase/server";

export async function getAvailableEquipmentAction(): Promise<EquipmentId[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [...DEFAULT_AVAILABLE_EQUIPMENT];
  return loadAvailableEquipment(supabase, user.id);
}
