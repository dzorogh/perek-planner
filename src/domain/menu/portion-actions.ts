"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type PortionActionState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

export async function updateSlotServingsAction(
  _prev: PortionActionState,
  formData: FormData,
): Promise<PortionActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const raw = Number(formData.get("servings"));

  if (!menuId || !slotId) {
    return { ok: false, error: "Некорректный слот." };
  }
  if (!Number.isInteger(raw) || raw < 1 || raw > 20) {
    return { ok: false, error: "Укажите число порций от 1 до 20." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };

  const { data, error } = await supabase
    .from("menu_slots")
    .update({ servings: raw })
    .eq("id", slotId)
    .eq("menu_id", menuId)
    .select("id");

  if (error || !data?.length) {
    return { ok: false, error: "Не удалось сохранить порции." };
  }

  revalidatePath("/plan/portions");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}
