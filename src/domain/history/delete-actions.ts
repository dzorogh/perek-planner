"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type DeleteMenuActionState =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteMenuAction(
  menuId: string,
): Promise<DeleteMenuActionState> {
  if (!menuId || typeof menuId !== "string") {
    return { ok: false, error: "Некорректный идентификатор меню." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Сессия истекла. Войдите снова." };
  }

  const { data, error } = await supabase
    .from("menus")
    .delete()
    .eq("id", menuId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Не удалось удалить меню." };
  }
  if (!data) {
    return { ok: false, error: "Меню не найдено." };
  }

  revalidatePath("/history");
  revalidatePath("/plan/menu");
  revalidatePath("/plan/shopping-list");
  return { ok: true };
}
