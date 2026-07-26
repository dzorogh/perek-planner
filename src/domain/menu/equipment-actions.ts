"use server";

import { revalidatePlanForMenu } from "@/domain/menu/revalidate-plan";
import { parseEquipmentCsv } from "@/domain/menu/equipment";
import { upsertAvailableEquipment } from "@/domain/settings/available-equipment";
import { createClient } from "@/lib/supabase/server";

export type UpdateMenuEquipmentState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function updateMenuEquipmentAction(
  _prev: UpdateMenuEquipmentState,
  formData: FormData,
): Promise<UpdateMenuEquipmentState> {
  const menuId = String(formData.get("menuId") ?? "").trim();
  const equipment = parseEquipmentCsv(formData.get("equipment"));
  if (!menuId) return { ok: false, error: "Меню не найдено." };
  if (!equipment) {
    return { ok: false, error: "Выберите хотя бы один вид техники." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { data, error } = await supabase
    .from("menus")
    .update({ available_equipment: equipment })
    .eq("id", menuId)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    return { ok: false, error: "Не удалось сохранить технику." };
  }

  await upsertAvailableEquipment(supabase, user.id, equipment);

  revalidatePlanForMenu(menuId);
  return { ok: true };
}
